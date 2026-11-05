import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Express, Request, Response } from "express";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import { env, isProduction, isTest } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimit";
import analyticsRoutes from "./modules/analytics/analytics.routes";
import auditRoutes from "./modules/audit/audit.routes";
import authRoutes from "./modules/auth/auth.routes";
import complaintRoutes from "./modules/complaints/complaint.routes";
import demoRoutes from "./modules/demo/demo.routes";
import feedbackRoutes from "./modules/feedback/feedback.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import slaRoutes from "./modules/sla/sla.routes";
import departmentRoutes from "./modules/departments/department.routes";
import organizationRoutes from "./modules/organizations/organization.routes";
import userRoutes from "./modules/users/user.routes";
import { sendSuccess } from "./utils/apiResponse";

// app.ts builds the Express app but does NOT start listening.
// server.ts starts it. This split lets tests use the app without opening a port.
export function createApp(): Express {
  const app = express();

  // Needed on Render so rate limiting and secure cookies see the real client/protocol.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL, // only our frontend may call the API from a browser
      credentials: true, // allow the refresh-token cookie (Phase 3)
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(mongoSanitize()); // strips $ and . keys to block NoSQL injection
  if (!isTest) app.use(morgan(isProduction ? "combined" : "dev"));
  app.use("/api", apiLimiter);

  // Health check: used by Render and by you to verify the server and database are up.
  app.get("/api/v1/health", (_req: Request, res: Response) => {
    const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
    sendSuccess(res, {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      database: dbStates[mongoose.connection.readyState] ?? "unknown",
    });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/organization", organizationRoutes);
  app.use("/api/v1/departments", departmentRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/complaints", complaintRoutes);
  app.use("/api/v1/demo", demoRoutes);
  app.use("/api/v1/notifications", notificationRoutes);
  app.use("/api/v1/sla-policies", slaRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);
  app.use("/api/v1/audit-logs", auditRoutes);
  app.use("/api/v1/feedback", feedbackRoutes);
  // More feature routers are mounted here in later phases.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
