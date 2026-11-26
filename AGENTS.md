# Language conventions

Reply to the user in French by default. Write agent definitions, agent handoffs, and project guides in English. When a guide refers to text shown in the interface, quote the original label so the reader can find it on screen.

## Feature documentation

Feature documentation lives in [`docs/`](docs/).

## Module boundaries

`src/app/` composes routes and screens. Each domain module in `src/modules/` owns its types, API calls and UI. `src/core/` holds reusable components and infrastructure without importing domain modules. Keep components in their module until there is a concrete reason to share them.

Keep tests outside `src/`. When writing, reviewing or running behavioral tests, use the [frontend-testing skill](.opencode/skills/frontend-testing/SKILL.md).
