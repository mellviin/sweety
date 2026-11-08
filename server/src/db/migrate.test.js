import { runMigrations } from "./migrate.js";

describe("runMigrations", () => {
  test("applies each migration once across repeated runs", async () => {
    const appliedMigrations = new Set();
    const statements = [];
    const client = {
      async query(sql, parameters = []) {
        const statement = sql.trim();
        statements.push(statement);

        if (statement.startsWith("SELECT migration_name")) {
          return {
            rowCount: appliedMigrations.has(parameters[0]) ? 1 : 0,
          };
        }

        if (statement.startsWith("INSERT INTO schema_migrations")) {
          appliedMigrations.add(parameters[0]);
        }

        return { rowCount: 0 };
      },
      release() {},
    };
    const database = {
      async connect() {
        return client;
      },
    };

    await runMigrations(database);
    await runMigrations(database);

    expect(appliedMigrations).toEqual(new Set(["001_init.sql"]));
    expect(statements.filter((sql) => sql.startsWith("CREATE TABLE users"))).toHaveLength(1);
    expect(statements.filter((sql) => sql === "BEGIN")).toHaveLength(1);
    expect(statements.filter((sql) => sql === "COMMIT")).toHaveLength(1);
  });
});
