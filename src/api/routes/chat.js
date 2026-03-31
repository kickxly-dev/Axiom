/**
 * src/api/routes/chat.js
 *
 * POST /chat
 *
 * Body:
 *   { channelId, message, userId? }
 *
 * Returns:
 *   { reply }
 */

import { Router } from "express";
import { processMessage } from "../../agent.js";
import { buildMemoryContext, getProfile } from "../../db/memory.js";
import { PERSONAS } from "../../agent.js";

const router = Router();

router.post("/", async (req, res) => {
  const { channelId, message, userId } = req.body || {};

  if (!channelId || typeof channelId !== "string") {
    return res.status(400).json({ error: "channelId is required" });
  }
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const context = {};
  if (userId) {
    const profile = getProfile(userId);
    const persona = PERSONAS[profile.persona] || PERSONAS.concise;
    context.personaPrompt = persona.instruction;
    context.memoryContext = buildMemoryContext(userId);
    context.userId = userId;
  }

  try {
    const reply = await processMessage(channelId, message, context);
    res.json({ reply });
  } catch (err) {
    console.error("[API /chat]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
