// Tiny logger so we avoid an extra dependency. Can be swapped for pino later
// without touching the rest of the code, because everything imports this file.
const isTestEnv = process.env.NODE_ENV === "test";

function log(level: "INFO" | "WARN" | "ERROR", message: string, meta?: unknown): void {
  if (isTestEnv) return; // keep test output clean
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  if (level === "ERROR") {
    console.error(line, meta ?? "");
  } else if (level === "WARN") {
    console.warn(line, meta ?? "");
  } else {
    console.log(line, meta ?? "");
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => log("INFO", message, meta),
  warn: (message: string, meta?: unknown) => log("WARN", message, meta),
  error: (message: string, meta?: unknown) => log("ERROR", message, meta),
};
