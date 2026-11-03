import http from "http";
import { createApp } from "./app";
import { connectDB, disconnectDB } from "./config/db";
import { env } from "./config/env";
import { startSlaJob } from "./jobs/slaEscalation.job";
import { initSocket } from "./sockets";
import { logger } from "./utils/logger";

async function start(): Promise<void> {
  await connectDB();

  const app = createApp();
  // We create the HTTP server ourselves (instead of app.listen) because
  // Socket.IO needs to attach to this same server.
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info(`ResolveX API running on port ${env.PORT} (${env.NODE_ENV})`);
    startSlaJob();
  });

  // Graceful shutdown: finish in-flight requests, then close the DB.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
