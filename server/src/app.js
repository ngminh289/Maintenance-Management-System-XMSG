/**
 * app.js — Cấu hình Express: middleware, routes, xử lý lỗi.
 * MVC: routes → controllers → services → models/db.
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { env } from "./config/env.js";
import { setUploadStaticHeaders } from "./config/uploadsStaticHeaders.js";
import { registerUploadsDocumentsGet } from "./routes/uploadsDocuments.route.js";
import { apiRouter } from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

export function createApp() {
  const app = express();
  const allowOrigins = new Set((env.clientOrigins || []).map(normalizeOrigin));

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        // Cho phép server-to-server / healthcheck không có Origin header.
        if (!origin) return cb(null, true);
        return cb(null, allowOrigins.has(normalizeOrigin(origin)));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

  // const limiter = rateLimit({
  //   windowMs: 15 * 60 * 1000,
  //   max: 300,
  //   standardHeaders: true,
  //   legacyHeaders: false,
  // });
  // app.use('/api', limiter);

  // Tài liệu: sendFile + headers (inline PDF/ảnh) — phải trước express.static để không bị ghi đè header
  registerUploadsDocumentsGet(app);
  app.use(
    "/uploads",
    express.static(join(__dirname, "..", "uploads"), {
      setHeaders: (res, filePath) => setUploadStaticHeaders(res, filePath),
    }),
  );

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
