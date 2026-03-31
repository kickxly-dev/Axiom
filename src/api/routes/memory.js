/**
 * src/api/routes/memory.js
 *
 * Memory CRUD endpoints.
 *
 *   GET    /memory/:userId          — list all memories for a user
 *   GET    /memory/:userId/:key     — get a single memory
 *   PUT    /memory/:userId/:key     — upsert a memory  { value }
 *   DELETE /memory/:userId/:key     — delete a memory
 *   GET    /memory/:userId/profile  — get user profile (persona, etc.)
 *   PUT    /memory/:userId/persona  — set persona  { persona }
 */

import { Router } from "express";
import {
  getProfile,
  setPersona,
  getMemories,
  getMemory,
  setMemory,
  deleteMemory,
} from "../../db/memory.js";
import { PERSONAS } from "../../agent.js";

const router = Router();

// GET /memory/:userId
router.get("/:userId", (req, res) => {
  const memories = getMemories(req.params.userId);
  res.json({ memories });
});

// GET /memory/:userId/profile
router.get("/:userId/profile", (req, res) => {
  const profile = getProfile(req.params.userId);
  res.json({ profile });
});

// PUT /memory/:userId/persona
router.put("/:userId/persona", (req, res) => {
  const { persona } = req.body || {};
  if (!persona || !PERSONAS[persona]) {
    return res.status(400).json({
      error: `Invalid persona. Valid options: ${Object.keys(PERSONAS).join(", ")}`,
    });
  }
  setPersona(req.params.userId, persona);
  res.json({ ok: true, persona });
});

// GET /memory/:userId/:key
router.get("/:userId/:key", (req, res) => {
  const mem = getMemory(req.params.userId, req.params.key);
  if (!mem) return res.status(404).json({ error: "Not found" });
  res.json({ memory: mem });
});

// PUT /memory/:userId/:key
router.put("/:userId/:key", (req, res) => {
  const { value } = req.body || {};
  if (value === undefined || value === null) {
    return res.status(400).json({ error: "value is required" });
  }
  const mem = setMemory(req.params.userId, req.params.key, String(value));
  res.json({ memory: mem });
});

// DELETE /memory/:userId/:key
router.delete("/:userId/:key", (req, res) => {
  const deleted = deleteMemory(req.params.userId, req.params.key);
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

export default router;
