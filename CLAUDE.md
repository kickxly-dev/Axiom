# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AXIOM is a multi-client AI platform that exposes a shared core agent across Discord, CLI, REST API, web UI, and Electron desktop interfaces. The codebase is Node.js ESM (`"type": "module"`), except Electron's main process which is CJS (`electron/main.cjs`).

## Commands

```bash
# Start modes (controlled by MODE in .env)
npm start              # Discord bot (default)
npm run desktop        # Terminal REPL
npm run start:api      # Express REST API (port 3000)
npm run start:web      # Static web server (port 8080)
npm run app            # Electron desktop GUI

# Development (auto-restart)
npm run dev            # Discord bot with --watch
npm run dev:api        # API with --watch
npm run dev:all        # All services concurrently
npm run app:dev        # Electron in dev mode

# Testing
npm test               # Run all vitest suites once
npm run test:watch     # Watch mode
```

To run a single test file: `npx vitest run tests/tools.test.js`

## Architecture

### Entry Point & Mode Selection

`src/index.js` reads `MODE` from `.env` and dynamically imports the appropriate client:

| MODE | Module | Purpose |
|------|--------|---------|
| `discord` (default) | `src/bot.js` | Discord bot, @mention triggered |
| `desktop` | `src/desktop.js` | Terminal REPL |
| `api` | `src/api/server.js` | Express REST API |
| `web` | `src/web-server.js` | Static file server |
| `cli` | `src/cli.js` | Commander.js CLI |
| *(electron)* | `electron/main.cjs` | Desktop GUI (separate process) |

### Core Agent (`src/agent.js`)

Central to all clients. Implements a **tool-use loop**:
1. Injects user persona + memory context into system prompt
2. Calls LLM (OpenRouter primary → Google Gemini fallback)
3. If response contains `tool_calls`, executes matching tools from registry
4. Feeds tool results back to LLM, repeating up to `MAX_TOOL_ROUNDS`
5. Returns final text

Key exports: `processMessage()` (full response), `processMessageStream()` (token stream), `clearHistory()`, `PERSONAS`.

Provider fallback: If `OPENROUTER_API_KEY` is set, it's always used. Otherwise falls back to `GOOGLE_AI_API_KEY` with Gemini format conversion.

### Tool System (`src/tools/`)

All tools export a consistent shape:
```javascript
export const myTool = {
  name: "tool_name",
  description: "...",      // What the LLM reads to select the tool
  parameters: { type: "object", properties: {}, required: [] },
  execute(params, context) { return result; }
}
```

`src/tools/index.js` auto-discovers and registers all tools. To add a tool: create a new file in `src/tools/`, export the tool object, and import it in `src/tools/index.js`.

Built-in tools: `calculator`, `datetime`, `remind`, `define`, `joke`, `coinflip`, `unitconvert`, `web_search`, `weather`, `sysinfo`, `files`, `run_code`, `shell`, `notes`.

### Memory & Personas (`src/db/memory.js`)

SQLite database (default `~/.axiom/axiom.db`, WAL mode). Two tables:
- `profiles` — per-user persona (concise/detailed/coder/coach/roast)
- `memories` — per-user key/value pairs

`buildMemoryContext(userId)` formats stored memories as a system prompt injection, automatically included in every `processMessage()` call for that user.

### API Routes (`src/api/routes/`)

- `POST /chat` — send message, get response from agent
- `GET /tools` / `POST /tools/execute` — tool registry inspection & direct invocation
- `GET|PUT|DELETE /memory/:userId/*` — memory CRUD
- `GET /health` — server status

### Electron (`electron/main.cjs`)

CJS main process loads the ESM agent via dynamic `import()`. IPC channels bridge renderer ↔ main for chat and streaming. Sessions persisted to `axiom-sessions.json`.

## Environment Variables

Copy `.env.example` to `.env`. At minimum, set one LLM provider key:

- `OPENROUTER_API_KEY` — primary LLM (supports any model on openrouter.ai)
- `GOOGLE_AI_API_KEY` — fallback Gemini provider
- `DISCORD_TOKEN` + `DISCORD_CLIENT_ID` — required for Discord mode
- `MODE` — runtime mode (discord/desktop/api/web/cli)
- `MAX_TOOL_ROUNDS` — prevent infinite tool loops (default 5)
- `MAX_HISTORY_TURNS` — conversation memory window (default 20)
- `OWNER_ID`, `ALLOWED_USER_IDS`, `ALLOWED_GUILD_IDS` — Discord access control
