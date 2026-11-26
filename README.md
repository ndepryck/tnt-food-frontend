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

First walkthrough: [how the home page is rendered](docs/reviews/home-page.md).
