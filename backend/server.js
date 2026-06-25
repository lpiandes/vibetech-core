import dotenv from "dotenv";
import express from "express";
import cors from "cors";

// Loads `backend/.env` if present. Production configs are expected to be injected
// by the deployment environment; `.env` is intentionally not committed.
dotenv.config();

const app = express();

// Security: disable the `X-Powered-By` header by default.
app.disable("x-powered-by");

// Body parsing for later route/controller work.
app.use(express.json());

// Cross-origin access for frontend apps and integrations.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin
      ? corsOrigin.split(",").map((s) => s.trim())
      : true,
  })
);

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(`[vibetech-core] Backend listening on port ${port}`);
});

// Graceful shutdown for production process managers.
const shutdown = (signal) => {
  console.log(`[vibetech-core] Received ${signal}. Shutting down...`);
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

