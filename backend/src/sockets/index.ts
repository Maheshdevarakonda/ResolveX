import http from "http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { User } from "../models/User";
import { logger } from "../utils/logger";
import { verifyAccessToken } from "../utils/tokens";
import { setIo } from "./io";

export { emitToUser } from "./io";

// Security model:
//  1. The client must present a valid access token in the handshake.
//  2. The SERVER decides which rooms a socket joins (user:<id> and org:<id>) from the verified user.
//  3. There is no "join room" event, so a client can never subscribe to someone else's channel.
export function initSocket(server: http.Server): Server {
  const io = new Server(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string") return next(new Error("Authentication required"));

      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select("organizationId role isActive").lean();
      if (!user || !user.isActive || String(user.organizationId) !== payload.orgId) {
        return next(new Error("Account is not available"));
      }

      socket.data.user = { id: String(user._id), organizationId: String(user.organizationId), role: user.role };
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { id, organizationId } = socket.data.user as { id: string; organizationId: string };
    socket.join(`user:${id}`);
    socket.join(`org:${organizationId}`);
    logger.info(`Socket connected for user ${id}`);
  });

  setIo(io);
  return io;
}
