---
name: frontend-testing
description: Write and review frontend component and live-backend browser tests using Given/When/Then scenarios.
---

Start with an acceptance criterion for the current subfeature. Describe it in English using Gherkin notation: **Given** the observable starting state, **When** the user acts, **Then** the expected outcome. Use `And` for a continuation. Put these steps in executable test names or named test steps rather than maintaining a duplicate prose specification. No Gherkin runner is required.

```gherkin
Scenario: Open a missing recipe
  Given the recipe does not exist
  When the user opens its detail URL
  Then the page shows “Recette introuvable”
  And offers a link back to the catalogue
```

- Place unit and component tests under `tests/unit/`, following the source module structure. Stub the HTTP boundary when exercising component failure, loading or retry behavior. Assert visible text, accessible controls and outcomes rather than component internals.
- Place browser scenarios under `tests/e2e/`. Use the real frontend, backend and isolated test database. Create disposable fixtures and clean them up even after a failure.
- QA runs `npm run test:unit` and `npm run test:e2e` and reports what actually ran. A mocked or manual run does not replace a live-backend E2E pass. Stop services started for verification when finished.

## QA report

For each suite, report the command, pass/fail/skip counts and measured elapsed time with units. Use the runner's duration or time the command; do not sum parallel test durations. Report environment setup separately from test execution.

List the scenarios actually exercised, not just the suite totals. For each, give a short Given/When/Then description, test level (unit, E2E or manual), expected versus observed result, status and individual duration when measured. Use “not measured” rather than estimating; list skipped or blocked scenarios separately with the reason.
