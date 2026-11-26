---
name: frontend-structure
description: Place frontend API calls, components and tests when adding or reviewing files in a domain module.
---

1. Read `docs/guidelines/frontend-structure.md` from the repository root.
2. Identify the backend resource for API changes or the user-facing responsibility for UI changes. Look for an existing owner before creating a folder.
3. Keep imports pointed at the owning file. After a move, check test mocks, styles and walkthrough links as well as application imports.
4. For a structure-only change, preserve HTTP payloads, responses and user behavior. Verify type checking, tests and the production build.
