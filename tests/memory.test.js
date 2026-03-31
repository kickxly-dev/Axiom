/**
 * tests/memory.test.js
 *
 * Tests for the SQLite memory/profile store.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setMemory, getMemory, getMemories, deleteMemory, getProfile, setPersona, buildMemoryContext, closeDb } from "../src/db/memory.js";

// Use a temp DB path for tests
import { tmpdir } from "os";
import { join }   from "path";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = join(tmpdir(), `axiom-test-${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;

afterEach(() => {
  closeDb();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

const USER = "test-user-123";

describe("memory CRUD", () => {
  it("sets and gets a memory", () => {
    setMemory(USER, "name", "Alice");
    const mem = getMemory(USER, "name");
    expect(mem).not.toBeNull();
    expect(mem.value).toBe("Alice");
  });

  it("updates an existing memory", () => {
    setMemory(USER, "city", "London");
    setMemory(USER, "city", "Paris");
    expect(getMemory(USER, "city").value).toBe("Paris");
  });

  it("lists all memories for a user", () => {
    setMemory(USER, "a", "1");
    setMemory(USER, "b", "2");
    const mems = getMemories(USER);
    expect(mems.length).toBe(2);
    const keys = mems.map((m) => m.key);
    expect(keys).toContain("a");
    expect(keys).toContain("b");
  });

  it("deletes a memory", () => {
    setMemory(USER, "temp", "value");
    expect(deleteMemory(USER, "temp")).toBe(true);
    expect(getMemory(USER, "temp")).toBeNull();
  });

  it("returns false when deleting nonexistent memory", () => {
    expect(deleteMemory(USER, "does_not_exist")).toBe(false);
  });
});

describe("profile / persona", () => {
  it("creates a default profile on first access", () => {
    const p = getProfile(USER);
    expect(p.user_id).toBe(USER);
    expect(p.persona).toBe("concise");
  });

  it("sets and reads persona", () => {
    setPersona(USER, "coder");
    expect(getProfile(USER).persona).toBe("coder");
  });
});

describe("buildMemoryContext", () => {
  it("returns empty string when no memories", () => {
    expect(buildMemoryContext("nobody")).toBe("");
  });

  it("includes key-value pairs in output", () => {
    setMemory(USER, "project", "Axiom");
    setMemory(USER, "language", "JavaScript");
    const ctx = buildMemoryContext(USER);
    expect(ctx).toMatch(/project.*Axiom/);
    expect(ctx).toMatch(/language.*JavaScript/);
  });
});
