import http from "http";
import { AddressInfo } from "net";
import { Server } from "socket.io";
import { Socket, io as connect } from "socket.io-client";
import { createApp } from "../../src/app";
import { notify } from "../../src/modules/notifications/notification.service";
import { setIo } from "../../src/sockets/io";
import { initSocket } from "../../src/sockets";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";
import { Tenant, createEmployee, createTenant } from "../helpers/tenants";

let server: http.Server;
let io: Server;
let url: string;
let a: Tenant;
const open: Socket[] = [];

function client(token?: string): Socket {
  const s = connect(url, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false });
  open.push(s);
  return s;
}
const connected = (s: Socket) => new Promise<void>((res, rej) => { s.on("connect", res); s.on("connect_error", rej); });
const nextEvent = (s: Socket, ms = 1500) =>
  new Promise<unknown>((res) => {
    const t = setTimeout(() => res(null), ms);
    s.once("notification", (payload) => { clearTimeout(t); res(payload); });
  });

beforeAll(async () => {
  await startTestDb();
  server = http.createServer(createApp());
  io = initSocket(server);
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  open.forEach((s) => s.close());
  setIo(null);
  await io.close();
  await stopTestDb();
});
beforeEach(async () => {
  await clearDb();
  a = await createTenant("org-a");
});

describe("Socket.IO real-time notifications", () => {
  it("rejects connections without a valid token", async () => {
    await expect(connected(client())).rejects.toThrow();
    await expect(connected(client("not-a-real-token"))).rejects.toThrow();
  });

  it("delivers a notification live, only to the intended user", async () => {
    const eve = await createEmployee(a, "eve@org-a.com");
    const eveSocket = client(eve.token);
    const customerSocket = client(a.customerToken);
    await Promise.all([connected(eveSocket), connected(customerSocket)]);

    const eveEvent = nextEvent(eveSocket);
    const customerEvent = nextEvent(customerSocket, 600);
    await notify({ organizationId: a.organizationId, userIds: [eve.id], type: "ASSIGNED", message: "Complaint RX-000001 was assigned to you" });

    expect(await eveEvent).toMatchObject({ type: "ASSIGNED", message: "Complaint RX-000001 was assigned to you", isRead: false });
    expect(await customerEvent).toBeNull();
  });

  it("clients cannot join other rooms (no join event exists on the server)", async () => {
    const s = client(a.customerToken);
    await connected(s);
    s.emit("join", `user:${a.adminId}`);
    const event = nextEvent(s, 600);
    await notify({ organizationId: a.organizationId, userIds: [a.adminId], type: "COMMENT", message: "Private to the admin" });
    expect(await event).toBeNull();
  });
});
