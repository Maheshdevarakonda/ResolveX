import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { notificationApi } from "../api";
import { API_ORIGIN, tokenStore } from "../api/client";
import type { AppNotification } from "../types";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

// Browsers' window event other pages can listen to, to refresh themselves when something changes.
export const NOTIFICATION_EVENT = "resolvex:notification";

interface RealtimeState {
  unread: number;
  setUnread: (n: number | ((n: number) => number)) => void;
  connected: boolean;
}
const RealtimeContext = createContext<RealtimeState>({ unread: 0, setUnread: () => undefined, connected: false });

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) { setUnread(0); return; }
    notificationApi.list({ page: 1, limit: 1, unread: true }).then((r) => setUnread(Number(r.meta.unread ?? 0))).catch(() => undefined);

    // `auth` is a function so every (re)connection uses the CURRENT access token.
    const socket: Socket = io(API_ORIGIN, {
      auth: (cb) => cb({ token: tokenStore.get() }),
      transports: ["websocket", "polling"],
    });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("notification", (n: AppNotification) => {
      setUnread((c) => c + 1);
      toast.info(n.message);
      window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: n }));
    });
    return () => { socket.close(); setConnected(false); };
    // toast is stable (memoised); userId changes only on login/logout
  }, [userId, toast]);

  const value = useMemo(() => ({ unread, setUnread: (n: number | ((c: number) => number)) => setUnread(n), connected }), [unread, connected]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);

// Calls `refresh` whenever a live notification arrives. Pages use it to stay up to date.
export function useLiveRefresh(refresh: () => void, complaintId?: string) {
  const callback = useCallback((e: Event) => {
    const n = (e as CustomEvent<AppNotification>).detail;
    if (!complaintId || n.complaintId === complaintId) refresh();
  }, [refresh, complaintId]);
  useEffect(() => {
    window.addEventListener(NOTIFICATION_EVENT, callback);
    return () => window.removeEventListener(NOTIFICATION_EVENT, callback);
  }, [callback]);
}
