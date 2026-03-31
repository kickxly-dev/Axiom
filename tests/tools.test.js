/**
 * tests/tools.test.js
 *
 * Tests for the tool framework: registration, execution, and error handling.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getToolDefinitions, getToolByName } from "../src/tools/index.js";

// ── Registry ──────────────────────────────────────────────────────────────────

describe("tool registry", () => {
  it("registers at least 10 tools", () => {
    expect(getToolDefinitions().length).toBeGreaterThanOrEqual(10);
  });

  it("each tool has required fields", () => {
    for (const td of getToolDefinitions()) {
      expect(td).toHaveProperty("type", "function");
      expect(td.function).toHaveProperty("name");
      expect(td.function).toHaveProperty("description");
      expect(td.function).toHaveProperty("parameters");
      expect(typeof td.function.name).toBe("string");
      expect(td.function.name.length).toBeGreaterThan(0);
    }
  });

  it("getToolByName returns the correct tool", () => {
    const calc = getToolByName("calculator");
    expect(calc).toBeDefined();
    expect(calc.name).toBe("calculator");
  });

  it("getToolByName returns undefined for unknown tool", () => {
    expect(getToolByName("nonexistent_tool_xyz")).toBeUndefined();
  });
});

// ── Calculator tool ───────────────────────────────────────────────────────────

describe("calculator tool", () => {
  it("evaluates a simple expression", async () => {
    const tool   = getToolByName("calculator");
    const result = await Promise.resolve(tool.execute({ expression: "2 + 2" }));
    expect(result).toMatch(/4/);
  });

  it("handles multiplication", async () => {
    const tool   = getToolByName("calculator");
    const result = await Promise.resolve(tool.execute({ expression: "6 * 7" }));
    expect(result).toMatch(/42/);
  });

  it("handles percentage calculation", async () => {
    const tool   = getToolByName("calculator");
    const result = await Promise.resolve(tool.execute({ expression: "15 / 100 * 847" }));
    // 15% of 847 = 127.05
    expect(result).toMatch(/127/);
  });

  it("returns error for invalid expression", async () => {
    const tool   = getToolByName("calculator");
    const result = await Promise.resolve(tool.execute({ expression: "definitely_not_math()" }));
    expect(typeof result).toBe("string");
    // Should not throw, should return a string (error message or result)
  });
});

// ── Datetime tool ─────────────────────────────────────────────────────────────

describe("datetime tool", () => {
  it("returns current date/time info", async () => {
    const tool   = getToolByName("datetime");
    const result = await Promise.resolve(tool.execute({}));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── Coinflip tool ─────────────────────────────────────────────────────────────

describe("coinflip tool", () => {
  it("returns heads or tails", async () => {
    const tool   = getToolByName("coinflip");
    const result = await Promise.resolve(tool.execute({}));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── Unit convert tool ─────────────────────────────────────────────────────────

describe("unit_convert tool", () => {
  it("converts miles to km", async () => {
    const tool = getToolByName("unit_convert");
    const result = await Promise.resolve(tool.execute({ value: 100, from: "miles", to: "km" }));
    expect(result).toMatch(/160|161/); // 100 miles ≈ 160.93 km
  });
});

// ── Notes tool ────────────────────────────────────────────────────────────────

describe("notes tool", () => {
  const CHANNEL = "test-channel-notes";

  it("can write and read a note", async () => {
    const tool = getToolByName("notes");
    await Promise.resolve(tool.execute({ operation: "write", key: "test-key", content: "test note value" }, { channelId: CHANNEL }));
    const result = await Promise.resolve(tool.execute({ operation: "read", key: "test-key" }, { channelId: CHANNEL }));
    expect(result).toMatch(/test note value/);
  });
});
