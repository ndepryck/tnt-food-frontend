# How the TNT Food home page is rendered

This walkthrough describes the original static home page. The current home route renders the recipe catalogue; see [Navigation and API](01-navigation-and-api.md).

The original home page showed “TNT Food” twice: once in the browser tab and once above the welcome message. The two titles looked alike, but they came from different files.

## Reading order: from the document to the screen

1. [`index.html`](../../index.html) — The browser uses `<title>` to name the tab. The document body has no welcome message yet: it contains an empty `<div id="root"></div>` and loads the startup module.
2. [`src/main.tsx`](../../src/main.tsx) — `createRoot` connects React to that empty element. `render(<App />)` tells React what to display there. `App` is a **component**: a function that describes part of the screen. `<App />` uses **JSX**, a way to write markup inside TypeScript. This file decides where the home page appears, but not what it says.
3. `App` originally returned the page heading (`h1`) and welcome paragraph (`p`) inside `main`. The current [`src/app/App.tsx`](../../src/app/App.tsx) instead chooses which screen to render.

## Verification

`npm ci` succeeded. `npm run build` checked the TypeScript types and wrote the production site to `dist/` (see the [npm scripts](../../package.json)). QA verified the home page in WebKit using the Vite development server. The Firefox result is unconfirmed.

## Original exercise (static home page)

Run `npm run dev` and open the URL printed by Vite. In `App`, temporarily replace the welcome paragraph with “Test message”. Save and reload the page.

**Expected result:** Only the paragraph changes. Both the page heading and the browser tab still say “TNT Food”. Restore the original text when you’re done.

This exercise checks static rendering. It does not exercise a backend request.
