import app from "./app.js";
import {
  assertDatabaseUrl,
  assertJwtSecret,
  config,
} from "./config/env.js";

let configurationValid = true;
try {
  assertDatabaseUrl();
  assertJwtSecret();
} catch (error) {
  console.error(`Server configuration error: ${error.message}`);
  configurationValid = false;
  process.exitCode = 1;
}

if (configurationValid) {
  app.listen(config.port, () => {
    console.info(`Sweety API listening on port ${config.port}`);
  });
}
