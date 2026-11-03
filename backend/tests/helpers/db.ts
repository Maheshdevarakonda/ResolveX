import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import "../../src/models/AuditLog";
import "../../src/models/Comment";
import "../../src/models/Complaint";
import "../../src/models/Counter";
import "../../src/models/Department";
import "../../src/models/Feedback";
import "../../src/models/Notification";
import "../../src/models/PasswordReset";
import "../../src/models/SLAPolicy";
import "../../src/models/Organization";
import "../../src/models/RefreshToken";
import "../../src/models/User";

// A throw-away in-memory MongoDB for tests. It runs as a replica set because
// transactions (used in organization registration) require one.
let replSet: MongoMemoryReplSet;

export async function startTestDb(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Build indexes (e.g. the unique email-per-organization index) before tests run.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await replSet.stop();
}

export async function clearDb(): Promise<void> {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
