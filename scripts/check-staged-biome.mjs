import { execFileSync, spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const files = process.argv.slice(2);
const biome = fileURLToPath(
  new URL("../node_modules/@biomejs/biome/bin/biome", import.meta.url),
);

if (files.length > 0) {
  const snapshot = mkdtempSync(join(tmpdir(), "frontend-biome-"));
  try {
    // Read raw index blobs: a Git checkout can apply CRLF or other filters.
    for (const file of ["biome.json", "package.json", ...files]) {
      const destination = join(snapshot, file);
      mkdirSync(dirname(destination), { recursive: true });
      const fd = openSync(destination, "w");
      try {
        execFileSync("git", ["cat-file", "blob", `:0:${file}`], {
          stdio: ["ignore", fd, "inherit"],
        });
      } finally {
        closeSync(fd);
      }
    }

    const result = spawnSync(
      process.execPath,
      [
        biome,
        "check",
        "--error-on-warnings",
        "--files-ignore-unknown=true",
        "--no-errors-on-unmatched",
        ...files,
      ],
      { cwd: snapshot, stdio: "inherit" },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }
}
