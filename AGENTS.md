# Language conventions

Reply to the user in French by default. Write agent definitions, agent handoffs, and project guides in English. When a guide refers to text shown in the interface, quote the original label so the reader can find it on screen.

## Feature documentation

Feature documentation lives in [`docs/`](docs/).

## Module boundaries

`src/app/` composes routes and screens. Each domain module in `src/modules/` owns its types, API calls and UI. `src/core/` holds reusable components and infrastructure without importing domain modules. Keep components in their module until there is a concrete reason to share them.

For file placement and refactors, follow the [structure guideline](docs/guidelines/frontend-structure.md) and the [frontend-structure skill](.agents/skills/frontend-structure/SKILL.md). For behavioral tests, use the [frontend-testing skill](.agents/skills/frontend-testing/SKILL.md).

Author project skills once in `.agents/skills/<name>/SKILL.md`. Each `.opencode/skills/<name>/SKILL.md` is a regular Markdown file that directs OpenCode to the shared instructions. Do not duplicate the instructions or use symbolic links.
