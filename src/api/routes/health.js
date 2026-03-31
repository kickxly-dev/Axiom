/**
 * src/api/routes/health.js
 *
 * GET /health  — liveness / readiness probe.
 */

import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status:  "ok",
    version: process.env.npm_package_version || "2.0.0",
    uptime:  process.uptime(),
    ts:      new Date().toISOString(),
  });
});

export default router;
