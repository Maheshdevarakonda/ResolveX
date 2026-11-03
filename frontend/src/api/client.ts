import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { User } from "../types";

export const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000";

// The short-lived access token lives only in memory (never localStorage), so a script injected
// into the page cannot read it. The long-lived refresh token is an httpOnly cookie.
let accessToken: string | null = null;
export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};

export const api = axios.create({ baseURL: `${API_ORIGIN}/api/v1`, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

export interface AuthPayload {
  user: User;
  accessToken: string;
}

// Only one refresh at a time: if five requests fail together, they all wait for the same refresh
// (refresh tokens are single-use, so parallel refreshes would invalidate each other).
let refreshing: Promise<AuthPayload | null> | null = null;

export function refreshSession(): Promise<AuthPayload | null> {
  if (!refreshing) {
    refreshing = axios
      .post(`${API_ORIGIN}/api/v1/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const payload = res.data.data as AuthPayload;
        accessToken = payload.accessToken;
        return payload;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

let onAuthFailure: (() => void) | null = null;
export const setAuthFailureHandler = (fn: (() => void) | null) => {
  onAuthFailure = fn;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = original?.url?.startsWith("/auth/");
    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      const session = await refreshSession();
      if (session) {
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      }
      onAuthFailure?.();
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; errors?: { field: string; message: string }[] } | undefined;
    if (data?.errors?.length) return data.errors.map((e) => e.message).join(". ");
    if (data?.message) return data.message;
    if (!err.response) return "Cannot reach the server. Check your connection.";
  }
  return fallback;
}
