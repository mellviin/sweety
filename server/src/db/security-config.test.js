import { spawnSync } from "node:child_process";
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

test("nodemon watches source and ignores test files", async () => {
  const nodemon = JSON.parse(
    await readFile(resolve(repositoryRoot, "server/nodemon.json"), "utf8"),
  );

  expect(nodemon.watch).toEqual(["src"]);
  expect(nodemon.ignore).toContain("**/*.test.js");
});

test("the app health endpoint works without migration credentials", () => {
  const serverDirectory = resolve(repositoryRoot, "server");
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `process.env.MIGRATION_DATABASE_URL = "";
       const { default: app } = await import("./src/app.js");
       delete process.env.MIGRATION_DATABASE_URL;
       const { default: request } = await import("supertest");
       const response = await request(app).get("/health");
       if (response.status !== 200 || response.body.status !== "ok") {
         console.error("GET /health failed without migration credentials.");
         process.exitCode = 1;
       }`,
    ],
    { cwd: serverDirectory, encoding: "utf8" },
  );

  expect(result.status).toBe(0);
});

test.each([
  ["", "DATABASE_URL must be set before the API can start."],
  ["not-a-url", "DATABASE_URL must be a valid PostgreSQL connection URL."],
])("server reports invalid database configuration clearly", (databaseUrl, message) => {
  const result = spawnSync(
    process.execPath,
    ["src/server.js"],
    {
      cwd: resolve(repositoryRoot, "server"),
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    },
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`Server configuration error: ${message}`);
  expect(result.stderr).not.toContain("Invalid URL");
  expect(result.stderr).not.toContain("TypeError");
});
