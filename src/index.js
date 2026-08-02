import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pinoHttp from "pino-http";
import client from "prom-client";
import logger from "./logger.js";
import pool from "./db/connection.js";
import searchRouter from "./routes/search.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

const dbQueryDuration = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration in seconds",
  labelNames: ["query_type"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// Expose dbQueryDuration for use in routes
app.locals.dbQueryDuration = dbQueryDuration;

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : [];
app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server (no origin) and configured origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(pinoHttp({ logger }));

// Request instrumentation
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const route = req.route?.path || req.path;
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (err) {
    res.status(503).json({
      status: "unhealthy",
      error: "Database connection failed",
    });
  }
});

// Prometheus metrics endpoint — Bearer token required
app.get(
  "/metrics",
  (req, res, next) => {
    const token = process.env.METRICS_TOKEN;
    if (!token) return res.status(403).end();
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${token}`) return res.status(403).end();
    next();
  },
  async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  },
);

// Routes
app.use("/api", searchRouter);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found",
  });
});

// 5xx error handler — logs + optional Discord alert
app.use((err, req, res, next) => {
  logger.error({ err, method: req.method, url: req.url }, "unhandled error");
  const webhook = process.env.DISCORD_WEBHOOK_INFRA;
  if (webhook) {
    fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `❌ knowledge-db-api エラー: \`${req.method} ${req.path}\` → ${err.message}`,
      }),
    }).catch(() => {});
  }
  res.status(500).json({ success: false, error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "server started");
});
