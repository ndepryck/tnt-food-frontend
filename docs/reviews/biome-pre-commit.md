# Biome pre-commit hook

You edit a file under `src/`, run `git add` and `git commit -m "…"`. On screen, Git fires the hook and the terminal prints `Biome check (staged frontend files)…`. If the staged files pass, it prints `Passed` and the commit proceeds. If anything fails, it prints `Failed` with Biome diagnostics (`file:line:col` plus the rule) and Git aborts — no commit object is created until the hook exits 0.

This diff is repo tooling only: no application code and no React components are involved, and no test in `tests/` covers the hook.

## Reading order (scoped to this diff)

1. [package.json](../../package.json) — adds the `check` and `format` scripts and the `@biomejs/biome` 2.6.9 devDependency. Biome sits in the **same package.json and lockfile as React 19.2.8 and Vitest 5.1.2**, so one `npm ci` brings the linter in parity with the rest of the app toolchain — no separate install for the hook. Note the hook never lints `package.json` itself: the `files:` filter only matches `src/` and `tests/`.
2. [package-lock.json](../../package-lock.json) — pins Biome and its per-platform binaries, so every clone runs the same version.
3. [biome.json](../../biome.json) — the rules: 2-space indent, 80-column lines, `recommended` lint preset. In Biome 2.x, `biome check` covers formatting, lint, and import organization (assist).
4. [.pre-commit-config.yaml](../../.pre-commit-config.yaml) — Gitleaks scans staged changes across the repository for secrets. The separate local Biome hook runs `node scripts/check-staged-biome.mjs` on `src/` and `tests/`, including the frontend security rules in `biome.json`.
5. [scripts/check-staged-biome.mjs](../../scripts/check-staged-biome.mjs) — the raw Git index runner (below).
6. [README.md](../../README.md) — per-clone setup steps and repo-wide check instructions.

## Who owns the data and how it flows

- **Git** owns the index. **pre-commit** (the Python framework; the config requires **3.2.0 or newer** via `minimum_pre_commit_version`, and older versions refuse to run the hooks) collects the staged filenames, matches them against `files: ^(src|tests)/`, temporarily sets aside unstaged edits, and appends the matching filenames as arguments to `node scripts/check-staged-biome.mjs`.
- For `biome.json`, `package.json` and each selected source or test file it runs `git cat-file blob :0:<file>` — stage 0, the raw index blob — into a fresh temporary snapshot directory, then runs the lockfile-pinned Biome from `node_modules/@biomejs/biome/bin/biome` via Node with `cwd` set to the snapshot: `check --error-on-warnings --files-ignore-unknown=true --no-errors-on-unmatched <files…>`. Diagnostics therefore print repo-relative paths. The exit status is propagated (non-zero blocks the commit) and the snapshot is always deleted. There is no `--write`: the hook is check-only and never modifies files. The staged `package.json` supplies dependency context for React and Vitest lint rules; an unstaged manifest edit cannot disable those rules in the hook.
- **LF/CRLF and partial-staging outcomes:** because the checked bytes are raw index blobs (LF-normalized), working-tree CRLF line endings or any other checkout filter cannot change the result. With partial staging, the staged version is authoritative: staged-clean + unstaged-bad passes; staged-bad + fixed working tree still fails until you `git add` the fix. One caveat: pre-commit’s own stash/restore of unstaged edits goes through Git’s checkout path, so on restore the working copy’s line endings can be normalized according to `core.autocrlf`/`.gitattributes` — the check itself still saw the raw index bytes.
- Why it is split this way: rules live in one file (`biome.json`) shared by the hook, `npm run check` and editor integrations; the config entry stays a plain `node` call (`language: system` — no isolated environment, nothing downloaded at hook time); the binary comes from `node_modules` via the lockfile. The index-snapshot logic lives in `scripts/` so the hook always checks what will actually be committed, not what happens to be in the working copy.

## Installation per clone

From `frontend/`: run `npm ci` (installs the pinned Biome together with React/Vitest), make sure [pre-commit](https://pre-commit.com/#install) **3.2.0 or newer** is on your `PATH` (e.g. `pipx install pre-commit`), then `pre-commit install`. If you already use a custom Git hook, check how it is configured first — `pre-commit install` writes its own shim into `.git/hooks`, which is not versioned, so every clone must opt in. Manual equivalents: `npm run check` (read-only; warnings fail too) and `npm run format` (rewrites formatting in `src/` and `tests/`).

## Fix-and-restage workflow

When the hook fails: read the diagnostics, run `npm run format` — or format only the file you are changing with `./node_modules/.bin/biome format --write path/to/file.tsx` — fix any remaining lint diagnostics by hand, then `git add` the fixed file and commit again. The hook re-checks the **whole staged file**, not just your lines. `git commit --no-verify` bypasses the hook once but is not recommended.

## Repo-wide baseline

When the hook was introduced, the initial scan found 70 errors and 21 warnings. Use `npm run check` for the current working-tree result. At commit time the hook instead checks each selected file in full, using its staged contents.

## Scenario and QA status (all checks completed)

There is no Given/When/Then spec in `tests/` for this tooling change; the behavioral scenario is the commit flow itself:

- **Given** a staged file under `src/` that violates a rule, **When** `git commit` runs, **Then** the “Biome check (staged frontend files)” hook fails with diagnostics and the commit is aborted.
- **Given** a staged config file outside `src/` and `tests/`, **when** a commit runs, **then** Biome skips it but Gitleaks can still block the commit on a recognized token. Its report redacts the value.

Completed QA for this tooling slice:

- Hook rejection: a staged React probe file was rejected by the hook in **0.437 s** — diagnostics printed, exit 1, no commit created. Passing and partial-staging outcomes (staged bytes checked regardless of unstaged edits or CRLF in the working copy) were verified the same way.
- Unit suite: `npm run test:unit` — 8 files, **48/48 tests passed**, Vitest Duration **1.90 s**.
- E2E suite: `npm run test:e2e` — **8/8 Chromium scenarios passed in 8.7 s** against the isolated FastAPI + PostgreSQL stack (catalogue picker debounce; combined filters with reversed sort; detail read and reload; recipe CRUD surviving reload and Back; ingredient add/edit/unlink; step append/drag/edit/reposition/delete with canonical numbering; long-list drag to the offscreen last step; shell navigation with reload and browser Back). The isolated stack was stopped and removed afterward. These app suites are unaffected by this tooling diff; they ran as regression context.

## Suggested exercise (not a completed check)

In a scratch clone: `npm ci`, `pre-commit install`, then create `src/tmp-biome-check.ts` with 4-space indentation, `git add` it and run `git commit -m test`. **Expected:** the hook fails with a format diff for that file and `git log` shows no new commit. Then run `npm run format`, `git add src/tmp-biome-check.ts`, and commit again: **expected** the hook passes and the commit is created. Remove the temp file afterward.

**Limitations:** the `files: ^(src|tests)/` filter means `package.json`, `biome.json`, YAML and Markdown are never linted by the hook; the check is whole-file and check-only (no auto-fix); the runner reads `:0:biome.json`, so it assumes `biome.json` exists in the index (true for every commit once this diff is committed; it errors if the file is absent from the index); setup is per clone and requires `npm ci` first — without `node_modules/@biomejs/biome/bin/biome` the hook fails and blocks commits; pre-commit must be ≥ 3.2.0 (`minimum_pre_commit_version`); and pre-commit’s stash/restore round-trip can normalize your working-tree line endings on restore even though the check read raw index bytes.
