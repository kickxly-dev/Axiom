/**
 * src/db/memory.js
 *
 * Per-user memory and profile store backed by SQLite.
 *
 * Tables:
 *   profiles  — per-user settings: selected persona, custom system prompt
 *   memories  — key/value facts the user or agent stores about a user
 *
 * Usage:
 *   import { getProfile, setPersona, addMemory, getMemories } from "./db/memory.js";
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";

// ── DB path ───────────────────────────────────────────────────────────────────

function getDbPath() {
  const envPath = process.env.DB_PATH;
  if (envPath) return envPath;
  // Default: store in platform user-data dir
  const dataDir = path.join(os.homedir(), ".axiom");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "axiom.db");
}

// ── Database singleton ────────────────────────────────────────────────────────

let _db = null;

function db() {
  if (!_db) {
    _db = new Database(getDbPath());
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id   TEXT PRIMARY KEY,
      persona   TEXT NOT NULL DEFAULT 'concise',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS memories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(user_id, key)
    );

    CREATE INDEX IF NOT EXISTS memories_user_idx ON memories(user_id);
  `);
}

// ── Profile helpers ───────────────────────────────────────────────────────────

/**
 * Get or create a user profile.
 * @param {string} userId
 * @returns {{ user_id: string, persona: string }}
 */
export function getProfile(userId) {
  const d = db();
  let row = d.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  if (!row) {
    d.prepare(
      "INSERT INTO profiles (user_id, persona) VALUES (?, 'concise')"
    ).run(userId);
    row = d.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  }
  return row;
}

/**
 * Set the persona for a user.
 * @param {string} userId
 * @param {string} persona
 */
export function setPersona(userId, persona) {
  const d = db();
  d.prepare(
    `INSERT INTO profiles (user_id, persona, updated_at)
     VALUES (?, ?, unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET persona = excluded.persona, updated_at = unixepoch()`
  ).run(userId, persona);
}

// ── Memory helpers ────────────────────────────────────────────────────────────

/**
 * Store or update a memory entry for a user.
 * @param {string} userId
 * @param {string} key
 * @param {string} value
 * @returns {{ id: number, user_id: string, key: string, value: string }}
 */
export function setMemory(userId, key, value) {
  const d = db();
  d.prepare(
    `INSERT INTO memories (user_id, key, value, updated_at)
     VALUES (?, ?, ?, unixepoch())
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`
  ).run(userId, key, value);
  return d
    .prepare("SELECT * FROM memories WHERE user_id = ? AND key = ?")
    .get(userId, key);
}

/**
 * Get a single memory entry.
 * @param {string} userId
 * @param {string} key
 * @returns {{ id: number, user_id: string, key: string, value: string }|null}
 */
export function getMemory(userId, key) {
  return db()
    .prepare("SELECT * FROM memories WHERE user_id = ? AND key = ?")
    .get(userId, key) ?? null;
}

/**
 * Get all memories for a user.
 * @param {string} userId
 * @returns {Array<{ id: number, key: string, value: string }>}
 */
export function getMemories(userId) {
  return db()
    .prepare("SELECT id, key, value, created_at, updated_at FROM memories WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId);
}

/**
 * Delete a memory entry.
 * @param {string} userId
 * @param {string} key
 * @returns {boolean} true if a row was deleted
 */
export function deleteMemory(userId, key) {
  const r = db()
    .prepare("DELETE FROM memories WHERE user_id = ? AND key = ?")
    .run(userId, key);
  return r.changes > 0;
}

/**
 * Build a memory context string to inject into the system prompt.
 * @param {string} userId
 * @returns {string}
 */
export function buildMemoryContext(userId) {
  const mems = getMemories(userId);
  if (mems.length === 0) return "";
  const lines = mems.map((m) => `- ${m.key}: ${m.value}`).join("\n");
  return `\n\nUser memory:\n${lines}`;
}

/**
 * Close the database connection (for tests/cleanup).
 */
export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
