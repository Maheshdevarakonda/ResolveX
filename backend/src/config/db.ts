import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

export async function connectDB(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("error", (err) => logger.error("MongoDB error", err));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  logger.info("MongoDB connected");
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
