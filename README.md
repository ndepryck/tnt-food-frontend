# TNT Food — frontend

Frontend built with React, TypeScript, and Vite. To run the home page locally with Node 22.12+:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. `npm run build` checks the TypeScript types and writes the production site to `dist/`.

## Working with the agents

Start an OpenCode session in this directory and describe the desired behavior to `frontend-orchestrator`. For example: “Add a keyboard-accessible link that takes me back to the top of the home page.”

The orchestrator delegates implementation to `frontend-implementer`. Then `frontend-reviewer` reads the change while `frontend-qa` checks the user flows. After any fixes, `frontend-guide` writes an English walkthrough in `docs/reviews/`. The [agent definitions](.opencode/agents/) describe each role.

Implementation walkthroughs:

1. [Navigation and API reads](docs/reviews/01-navigation-and-api.md)
2. [Catalogue and live filters](docs/reviews/02-catalogue-and-filters.md)

For local services and test commands, see [Testing](docs/testing.md).

## Recipe interface

[Feature specification](docs/recipes-spec.md) · [Mockups and design guide](docs/design/recipes/README.md)

To work incrementally in OpenCode, ask `frontend-orchestrator` for a named
block, such as “Implement block 1 of the recipe interface specification.”
