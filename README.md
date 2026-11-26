# TNT Food — frontend

Frontend built with React, TypeScript, and Vite. To run the home page locally with Node 22.12+:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. `npm run build` checks the TypeScript types and writes the production site to `dist/`.

## Pre-commit checks: formatting, linting and security

In each fresh clone, run `npm ci`, make sure
[pre-commit](https://pre-commit.com/#install) 3.2.0 or newer is on your `PATH`
(for example, `pipx install pre-commit`), then run `pre-commit install` from the
frontend repository. If you already use a custom Git hook, check how it is
configured before installing.

- `npm run check` checks formatting, recommended lint rules, and import
  organization in `src/` and `tests/` without changing files. Warnings fail the
  check too.
- `npm run format` rewrites formatting only in those directories. During the
  migration, format only the file you are changing to avoid unrelated edits:
  `./node_modules/.bin/biome format --write path/to/file.tsx`.
- The pre-commit hook runs the locally installed, lockfile-pinned Biome on a
  temporary copy of staged files under `src/` and `tests/`, plus the staged
  `biome.json` and `package.json` so Biome can detect project dependencies.
  It checks the exact staged bytes even when the working copy has unstaged
  edits or CRLF line endings. Biome applies no fixes. The pre-commit framework
  may temporarily set aside and restore unstaged edits; Git can normalize
  working-copy line endings during that restore. Address diagnostics and stage
  the intended fixes before trying again.
- Gitleaks checks the **staged diff across the repository**, including files
  outside `src/` and `tests/`, for recognizable secrets such as access tokens
  and private keys. Diagnostics redact the matched value. Its first run
  installs the pinned hook; subsequent checks use the local cache. This is
  not a scan of the entire Git history or a guarantee that every secret is detected.
- Biome also flags React's `dangerouslySetInnerHTML`, global `eval`, and
  `javascript:` URLs in supported contexts. Prefer rendering untrusted strings
  as JSX text. These static checks do not audit dependency vulnerabilities.

**Existing baseline:** Before Biome was introduced, the app and tests already
had formatting, import organization, and lint violations. The initial scan
reported 70 errors and 21 warnings. This change does not reformat the whole
repository or suppress those diagnostics, so the full `npm run check` is
expected to fail until the baseline is cleaned up. The hook checks whole
staged files, not just changed lines.

## Working with the agents

Start an OpenCode session in this directory and describe the desired behavior to `frontend-orchestrator`. For example: “Add a keyboard-accessible link that takes me back to the top of the home page.”

The orchestrator delegates implementation to `frontend-implementer`. Then `frontend-reviewer` reads the change while `frontend-qa` checks the user flows. After any fixes, `frontend-guide` writes an English walkthrough in `docs/reviews/`. The [agent definitions](.opencode/agents/) describe each role.

Implementation walkthroughs:

1. [Navigation and API reads](docs/reviews/01-navigation-and-api.md)
2. [Catalogue and live filters](docs/reviews/02-catalogue-and-filters.md)
3. [Recipe detail: ingredients and preparation](docs/reviews/03-recipe-detail.md)
4. [Create, edit, and delete a recipe](docs/reviews/04-recipe-writes.md)
5. [Manage the ingredients in a recipe](docs/reviews/05-recipe-ingredients.md)
6. [Edit and reorder preparation steps](docs/reviews/06-preparation-steps.md)

For local services and test commands, see [Testing](docs/testing.md).

## Recipe interface

[Feature specification](docs/recipes-spec.md) · [Mockups and design guide](docs/design/recipes/README.md)

To work incrementally in OpenCode, ask `frontend-orchestrator` for a named
block, such as “Implement block 1 of the recipe interface specification.”
