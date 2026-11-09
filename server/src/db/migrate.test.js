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

        if (statement.startsWith("INSERT INTO sweety_meta.schema_migrations")) {
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

    expect(appliedMigrations).toEqual(new Set([
      "001_init.sql",
      "002_hardening.sql",
      "003_auth_hardening.sql",
      "004_security_events.sql",
    ]));
    const securityEventMigration = statements.find(
      (sql) => sql.includes("CREATE TABLE security_events"),
    );
    expect(securityEventMigration).toContain("GRANT SELECT, INSERT ON TABLE security_events TO sweety_app");
    expect(securityEventMigration).toContain("REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER");
    expect(statements.filter((sql) => sql.startsWith("CREATE TABLE users"))).toHaveLength(1);
    expect(statements.some((sql) => sql.startsWith("CREATE TABLE security_events"))).toBe(true);
    expect(statements.filter((sql) => sql === "BEGIN")).toHaveLength(4);
    expect(statements.filter((sql) => sql === "COMMIT")).toHaveLength(4);
  });
});
