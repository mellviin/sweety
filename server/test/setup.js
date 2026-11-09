process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "sweety-test-only-signing-key-at-least-32";

const { config } = await import("../src/config/env.js");

if (!config.testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must be set to run the test suite.");
}

if (!process.env.MIGRATION_DATABASE_URL) {
  throw new Error("MIGRATION_DATABASE_URL must be set to run the test suite.");
}
