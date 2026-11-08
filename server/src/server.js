import app from "./app.js";
import { assertJwtSecret, config } from "./config/env.js";

assertJwtSecret();
app.listen(config.port, () => {
  console.info(`Sweety API listening on port ${config.port}`);
});
