import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import {
  noStore,
  rejectPrototypeKeys,
  requireJsonContentType,
} from "./middleware/httpHardening.js";
import { strictFields } from "./middleware/strictFields.js";
import authRouter from "./routes/auth.js";
import reportsRouter from "./routes/reports.js";
import readingsRouter from "./routes/readings.js";
import { globalRateLimiter } from "./middleware/rateLimit.js";
import hpp from "hpp";

export function createApp() {
  const app = express();
  const allowedOrigins = config.clientUrl
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== "*");

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    strictTransportSecurity: process.env.NODE_ENV === "production"
      ? undefined
      : false,
    referrerPolicy: { policy: "no-referrer" },
    noSniff: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  }));
  app.use(["/auth", "/readings", "/reports"], noStore);
  app.use(cors({
    origin: (origin, callback) => {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }));
  app.use(globalRateLimiter);
  app.use(["/auth", "/readings", "/reports"], requireJsonContentType);
  app.use(express.json({ limit: "10kb" }));
  app.use(rejectPrototypeKeys);
  app.use(hpp({ checkQuery: false }));

  app.get(
    "/health",
    strictFields("body", []),
    strictFields("query", []),
    (_request, response) => {
      response.json({ status: "ok" });
    },
  );

  app.use("/auth", authRouter);
  app.use("/readings", readingsRouter);
  app.use("/reports", reportsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
