/** Logger ringkas berbasis pino dengan label modul. */
import pino from "pino";

const base = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { svc: "wa-gateway" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createLogger(module) {
  return base.child({ module });
}

export { base as logger };
