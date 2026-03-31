/**
 * src/api/routes/tools.js
 *
 * POST /tools/execute — directly invoke a named tool without going through the LLM.
 *
 * Body:
 *   { name, params, channelId? }
 *
 * Returns:
 *   { result }
 */

import { Router } from "express";
import { getToolDefinitions, getToolByName } from "../../tools/index.js";

const router = Router();

/**
 * List available tools.
 * GET /tools
 */
router.get("/", (_req, res) => {
  const tools = getToolDefinitions().map((t) => ({
    name:        t.function.name,
    description: t.function.description,
    parameters:  t.function.parameters,
  }));
  res.json({ tools });
});

/**
 * Execute a tool directly.
 * POST /tools/execute
 */
router.post("/execute", async (req, res) => {
  const { name, params, channelId = "api" } = req.body || {};

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }

  const tool = getToolByName(name);
  if (!tool) {
    return res.status(404).json({ error: `Tool "${name}" not found` });
  }

  const t0 = Date.now();
  try {
    const result = await Promise.resolve(tool.execute(params || {}, { channelId }));
    console.log(`[Tool] ✓ ${name}  via API  (${Date.now() - t0}ms)  result=${String(result).slice(0, 120)}`);
    res.json({ result });
  } catch (err) {
    console.error(`[Tool] ✗ ${name}  via API  EXEC_ERROR  ${err.message}  (${Date.now() - t0}ms)`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
