/**
 * index.js — Điểm vào server Express (HTTP).
 * Khởi động app, lắng nghe PORT; tách app vào app.js để test dễ hơn.
 */
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { getPool } from "./config/database.js";
import { startScheduler } from "./scheduler.js";

const app = createApp();

getPool()
  .getConnection()
  .then((conn) => {
    conn.release();
    app.listen(env.port, () => {
      console.log(`API: http://localhost:${env.port}`);
      startScheduler();
    });
  })
  .catch((err) => {
    console.error("Không kết nối được MySQL:", err.message);
    process.exit(1);
  });
