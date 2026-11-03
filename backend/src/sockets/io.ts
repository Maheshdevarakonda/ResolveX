import { Server } from "socket.io";

// Holds the Socket.IO server so any service can emit events without importing server.ts
// (which would create a circular import). In tests no server exists, and emitting is a silent no-op.
let io: Server | null = null;

export const setIo = (server: Server | null): void => {
  io = server;
};

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}
