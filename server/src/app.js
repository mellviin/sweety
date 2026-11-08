import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.js";
import reportsRouter from "./routes/reports.js";
import readingsRouter from "./routes/readings.js";
import { authRateLimiter } from "./middleware/rateLimit.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/auth", authRateLimiter, authRouter);
  app.use("/readings", readingsRouter);
  app.use("/reports", reportsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
