/**
 * src/api/server.js
 *
 * Axiom HTTP API server (Express).
 *
 * Routes:
 *   GET  /health
 *   POST /chat
 *   GET  /tools
 *   POST /tools/execute
 *   GET  /memory/:userId
 *   GET  /memory/:userId/profile
 *   PUT  /memory/:userId/persona
 *   GET  /memory/:userId/:key
 *   PUT  /memory/:userId/:key
 *   DELETE /memory/:userId/:key
 *
 * Start with:
 *   MODE=api npm start
 * or
 *   node src/api/server.js
 */

import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.js";
import chatRouter   from "./routes/chat.js";
import toolsRouter  from "./routes/tools.js";
import memoryRouter from "./routes/memory.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/chat",   chatRouter);
  app.use("/tools",  toolsRouter);
  app.use("/memory", memoryRouter);

  // Root info
  app.get("/", (_req, res) => {
    res.json({
      name:    "Axiom API",
      version: process.env.npm_package_version || "2.0.0",
      routes:  ["/health", "/chat", "/tools", "/tools/execute", "/memory/:userId"],
    });
  });

  // 404 fallback
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error("[API]", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

export async function startApiServer() {
  const port = parseInt(process.env.API_PORT || "3000", 10);
  const app  = createApp();
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`✅ Axiom API running on http://localhost:${port}`);
      resolve(server);
    });
  });
}
