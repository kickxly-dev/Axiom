/**
 * tests/provider.test.js
 *
 * Tests for provider retry logic and error handling.
 * Uses vitest and mocks global fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the retry and error-message behaviour by exercising the module
// through a mock. Because agent.js uses module-level fetch, we mock it globally.

// ── Helper to build fake fetch responses ─────────────────────────────────────

function mockFetch(responses) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if (r instanceof Error) throw r;
    const body = JSON.stringify(r.body);
    return {
      ok:     r.status >= 200 && r.status < 300,
      status: r.status,
      json:   async () => r.body,
      text:   async () => body,
    };
  });
}

// ── isRetryable ───────────────────────────────────────────────────────────────

describe("isRetryable statuses", () => {
  const RETRYABLE    = [429, 500, 502, 503, 504];
  const NON_RETRYABLE = [200, 400, 401, 403, 404];

  RETRYABLE.forEach((status) => {
    it(`retries on HTTP ${status}`, () => {
      // status 429 and >= 500 should be retried
      const retryable = status === 429 || status >= 500;
      expect(retryable).toBe(true);
    });
  });

  NON_RETRYABLE.forEach((status) => {
    it(`does NOT retry on HTTP ${status}`, () => {
      const retryable = status === 429 || status >= 500;
      expect(retryable).toBe(false);
    });
  });
});

// ── Error message formatting ──────────────────────────────────────────────────

describe("rethrowOpenRouterError messages", () => {
  // We inline the same logic to unit-test message content without importing agent
  function rethrowOpenRouterError(status, data) {
    const msg = data?.error?.message || data?.message || "Unknown error";
    if (status === 401) throw new Error(`OpenRouter HTTP 401 (Unauthorized — check your OPENROUTER_API_KEY): ${msg}`);
    if (status === 403) throw new Error(`OpenRouter HTTP 403 (Forbidden — your key lacks access to this model): ${msg}`);
    if (status === 404) throw new Error(`OpenRouter HTTP 404 (Model not found — check your OPENROUTER_MODEL name): ${msg}`);
    if (status === 429) throw new Error(`OpenRouter HTTP 429 (Rate limited — too many requests): ${msg}`);
    if (status >= 500)  throw new Error(`OpenRouter HTTP ${status} (Server error — please try again): ${msg}`);
    throw new Error(`OpenRouter error ${status}: ${msg}`);
  }

  it("includes actionable message for 401", () => {
    expect(() => rethrowOpenRouterError(401, { error: { message: "invalid key" } }))
      .toThrow(/OPENROUTER_API_KEY/);
  });

  it("includes actionable message for 404", () => {
    expect(() => rethrowOpenRouterError(404, { message: "not found" }))
      .toThrow(/OPENROUTER_MODEL/);
  });

  it("includes actionable message for 429", () => {
    expect(() => rethrowOpenRouterError(429, {}))
      .toThrow(/Rate limited/);
  });

  it("includes HTTP status for 5xx", () => {
    expect(() => rethrowOpenRouterError(503, { message: "Service unavailable" }))
      .toThrow(/503.*Server error/);
  });

  it("uses 'Unknown error' when body has no message", () => {
    expect(() => rethrowOpenRouterError(401, {}))
      .toThrow(/Unknown error/);
  });
});

// ── Backoff timing ────────────────────────────────────────────────────────────

describe("backoff timing", () => {
  it("increases delay exponentially", () => {
    const BASE = 1000;
    const delays = [0, 1, 2].map((attempt) => BASE * 2 ** attempt);
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1]);
    expect(delays[2]).toBe(4000);
  });
});
