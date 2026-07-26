import pino from "pino";

// production: JSON to stdout (compatible with GCP Cloud Logging via log drain)
// development: pretty-print via pino-pretty if available
const transport =
  process.env.NODE_ENV !== "production"
    ? { target: "pino/file", options: { destination: 1 } }
    : undefined;

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    // GCP Cloud Logging expects severity field
    formatters: {
      level(label) {
        return { severity: label.toUpperCase() };
      },
    },
    base: { service: "knowledge-db-api" },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport,
);

export default logger;
