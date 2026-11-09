import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../",
);

test("Compose requires database passwords and publishes PostgreSQL on localhost only", async () => {
  const compose = await readFile(
    resolve(repositoryRoot, "docker-compose.yml"),
    "utf8",
  );

  expect(compose).toContain('"127.0.0.1:5432:5432"');
  expect(compose).not.toContain("POSTGRES_HOST_AUTH_METHOD");
  expect(compose).toMatch(/POSTGRES_PASSWORD:\s+\$\{POSTGRES_PASSWORD:\?/);
  expect(compose).toMatch(/APP_DB_PASSWORD:\s+\$\{APP_DB_PASSWORD:\?/);
  expect(compose).toMatch(/MIGRATE_DB_PASSWORD:\s+\$\{MIGRATE_DB_PASSWORD:\?/);
});

test("Docker build context excludes environment files and dependency directories", async () => {
  const dockerIgnore = await readFile(
    resolve(repositoryRoot, ".dockerignore"),
    "utf8",
  );

  expect(dockerIgnore).toContain("**/.env");
  expect(dockerIgnore).toContain(".git");
  expect(dockerIgnore).toContain("**/node_modules");
});
