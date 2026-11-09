import { createServer } from "node:http";
import app from "./app.js";
import {
  assertDatabaseUrl,
  assertJwtSecret,
  config,
} from "./config/env.js";
import { logger } from "./utils/logger.js";

let configurationValid = true;
try {
  assertDatabaseUrl();
  assertJwtSecret();
} catch (error) {
  logger.error("server_configuration_error", { reason: error.message });
  configurationValid = false;
  process.exitCode = 1;
}

if (configurationValid) {
  const server = createServer(app);
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.listen(config.port, () => {
    logger.info("server_listening", { port: config.port });
  });
}
