import { execFileSync } from "node:child_process";

// Ingredient CRUD is not exposed by the API. Scope SQL to the disposable
// Compose project. Callers allocate their own UUIDs and delete them in finally.
export function fixtureSql(sql: string) {
  execFileSync("docker", ["compose", "-p", "tnt-food-frontend-e2e", "-f", "../compose.yaml",
    "-f", "compose.e2e.yaml", "exec", "-T", "db", "psql", "-U", "tnt_food", "-d", "tnt-food",
    "-v", "ON_ERROR_STOP=1", "-c", sql]);
}
