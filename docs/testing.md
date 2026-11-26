# Testing the app shell and API connection

From `frontend/`, with Node 22.12+ (LTS), npm and Docker Compose 2.24.4+
(`!override` support):

```sh
npm ci
npm run test:unit
npm run typecheck
npm run build
npx playwright install chromium
```

The component tests stub HTTP to exercise loading, empty results, an outage,
retry and a missing recipe. The browser suite uses real requests only.

## Live browser test

Keep `../backend`, `../docker/postgres` and `../compose.yaml` beside this
checkout. Use this separate project and these explicit files, **not** the
development override. The database uses a project-specific volume and has no
published port. The backend runs its migrations before serving requests.

```sh
docker compose -p tnt-food-frontend-e2e -f ../compose.yaml -f compose.e2e.yaml up --build --wait -d
npm run test:e2e
```

Keep ports 18000 (FastAPI) and 15173 (Vite) available for the suite.
Playwright starts and stops Vite, creates a uniquely named recipe through
the same `/v1` proxy as the UI, and deletes it by ID in teardown. No seed
import is required. The test opens the catalogue, follows a recipe link by
keyboard at a narrow viewport, reloads, navigates back, opens the detail
URL directly, and checks the missing-recipe screen after deletion.

For manual verification against the test database:

```sh
TNT_FOOD_API_URL=http://127.0.0.1:18000 npm run dev
```

Open `/recipes` on the URL printed by Vite. To verify outage recovery, stop
only the isolated backend (`docker compose -p tnt-food-frontend-e2e -f ../compose.yaml -f compose.e2e.yaml stop backend`)
and reload. Restart with the `up` command above and activate “Réessayer”
without reloading. Stop manual Vite with Ctrl+C. Remove only the isolated
stack and its data when finished:

```sh
docker compose -p tnt-food-frontend-e2e -f ../compose.yaml -f compose.e2e.yaml down -v
```

Outside the browser suite, the Vite proxy defaults to `http://127.0.0.1:8000`.
Override `TNT_FOOD_API_URL` for another backend address (such as
`http://backend:8000` inside Compose).
