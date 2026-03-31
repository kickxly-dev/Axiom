# Axiom

**Axiom** is a multi-client AI platform — Discord bot, HTTP API, CLI, and web interface — powered by a shared core backend. It works with **[OpenRouter](https://openrouter.ai)** (primary, recommended) or **[Google AI Studio](https://aistudio.google.com)** (fallback), with automatic retries, per-user memory, configurable personas, and a full tool set.

> **Migrating from Google AI Studio or the old Discord-only setup?** See the [migration notes](#migrating-from-google-ai-studio) below.

---

## 🏗️ Platform Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Clients                                │
│  Discord Bot │  CLI (axiom)  │  Web UI  │  Electron App     │
└──────┬───────┴───────┬───────┴────┬─────┴──────┬────────────┘
       │               │            │             │
       └───────────────┴────────────┴─────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Axiom Core API    │
                    │  src/api/server.js  │
                    │  POST /chat         │
                    │  POST /tools/exec   │
                    │  /memory CRUD       │
                    │  GET /health        │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼────────┐  ┌────▼────┐  ┌────────▼────────┐
    │  src/agent.js    │  │ Tools   │  │  src/db/memory  │
    │  OpenRouter/     │  │ 14+ inc.│  │  SQLite personas│
    │  Gemini + retry  │  │ calc,   │  │  + user memory  │
    │  Persona system  │  │ code,   │  └─────────────────┘
    │  Memory context  │  │ shell…  │
    └──────────────────┘  └─────────┘
```

### Components

| Component | Entry | Mode / Command |
|---|---|---|
| **Discord bot** | `src/bot.js` | `npm start` (default) |
| **HTTP API** | `src/api/server.js` | `npm run start:api` |
| **CLI** | `src/cli.js` | `npm run start:cli` / `node src/cli.js` |
| **Web client** | `web/index.html` | `npm run start:web` |
| **Desktop REPL** | `src/desktop.js` | `npm run desktop` |
| **Electron app** | `electron/main.cjs` | `npm run app` |
| **All at once** | — | `npm run dev:all` |

---

## ✨ Features

| Feature | Details |
|---|---|
| 🖥️ Desktop GUI | Clean dark-mode Electron app — streaming responses, session sidebar, tool pills |
| 💬 Discord Bot | Mention `@Axiom` or DM — plus commands: `!plan`, `!debug`, `!ship`, `!persona`, `!remember`, `!tooltest` |
| 🌐 HTTP API | REST API — `POST /chat`, `POST /tools/execute`, memory CRUD, `GET /health` |
| 🖥️ Web Client | Minimal dark-mode web UI served by `npm run start:web` |
| ⌨️ CLI | `axiom chat`, `axiom plan`, `axiom debug`, `axiom ship`, `axiom persona`, `axiom remember`, `axiom tooltest` |
| 🎯 Terminal REPL | Polished interactive terminal chat — `npm run desktop` |
| 🧠 AI Conversations | Full multi-turn conversation memory per channel/session |
| ⚡ Streaming | Tokens stream in real-time as the model generates them (Electron/desktop) |
| 🔁 Retry & Resilience | Auto-retry on 429 / 5xx with exponential backoff (configurable) |
| 🎭 Personas | Per-user modes: **concise**, **detailed**, **coder**, **coach**, **roast** — persist in SQLite |
| 💾 Memory Store | Per-user key/value memory persisted in SQLite, injected into every prompt |
| 🔧 Tool Observability | Structured logging for every tool call: name, args, result, errors, timing |
| 🔢 Calculator | Evaluate any math expression |
| 🕐 Date & Time | Get the current date/time in any timezone |
| ⏰ Reminders | "Remind me in 10 minutes to take a break" |
| 📖 Word Definitions | Look up any English word via free dictionary API |
| 😄 Jokes | Fetch a random joke by category |
| 🪙 Coin Flip / Dice | Flip a coin, roll a die, or pick randomly from a list |
| 📐 Unit Conversion | Convert between length, weight, volume, speed, and temperature |
| 🔍 Web Search | DuckDuckGo instant-answer lookups (no API key) |
| 🌤️ Weather | Current conditions for any city via Open-Meteo (no API key) |
| 💻 System Info | CPU, memory, OS, uptime — all local |
| 📁 File Reader | Read local text files and list directories safely |
| ▶️ Code Runner | Write and execute JavaScript or Python 3 code |
| 🐚 Shell | Run shell commands locally with safety guardrails |
| 📝 Notes | Agent scratchpad: save/read/list notes across tool rounds |
| ➕ Extensible | Add your own tools in minutes (see below) |

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- An **[OpenRouter](https://openrouter.ai/keys)** API key *(recommended — free tier available, no billing required)*
- *OR* a **[Google AI Studio](https://aistudio.google.com)** API key *(fallback)*
- *(Discord mode only)* A Discord account and a server where you can add bots

---

## 🚀 Setup Guide

### Step 1 — Get an OpenRouter API key (recommended)

1. Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign in (GitHub or Google) and click **"Create key"**
3. Copy the key

OpenRouter provides a free credit allowance and access to dozens of models — including Google Gemini, GPT-4o, Claude, and more — without requiring Google billing.

> **Using Google AI Studio instead?**  
> If you prefer to use Google AI Studio directly, set `GOOGLE_AI_API_KEY` in `.env` and leave `OPENROUTER_API_KEY` empty. Axiom will automatically fall back to Gemini. See the [fallback configuration](#google-ai-studio-fallback) section below.

---

### Step 2 — Clone / Download Axiom

```bash
git clone https://github.com/kickxly-dev/Axiom.git
cd Axiom
```

---

### Step 3 — Install Node.js dependencies

```bash
npm install
```

---

### Step 4 — Configure environment variables

Open the `.env` file in the project root and fill in your values:

```env
# Choose "discord" or "desktop"
MODE=discord

# --- Primary provider: OpenRouter (recommended) ---
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free

# --- Fallback provider: Google AI Studio (only used if OPENROUTER_API_KEY is not set) ---
# GOOGLE_AI_API_KEY=your_google_ai_api_key_here
# GOOGLE_AI_MODEL=gemini-2.0-flash

# Discord bot token (only needed for MODE=discord)
DISCORD_TOKEN=your_discord_bot_token_here
```

**Choosing an OpenRouter model:**

| Model slug | Notes |
|---|---|
| `google/gemini-2.0-flash-exp:free` | Free tier — fast, good quality (default) |
| `meta-llama/llama-3.1-8b-instruct:free` | Free tier — lightweight |
| `google/gemini-2.5-pro` | Paid — Google's most capable model |
| `openai/gpt-4o` | Paid — OpenAI flagship |
| `anthropic/claude-3.5-sonnet` | Paid — Anthropic flagship |

Browse the full list at [openrouter.ai/models](https://openrouter.ai/models). Filter by **"Free"** to find no-cost options.

---

### Step 5 — (Discord mode only) Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**, name it `Axiom`
3. In the left sidebar click **"Bot"** → **"Add Bot"** → **"Yes, do it!"**
4. Under **"Token"** click **"Reset Token"** and copy it into `DISCORD_TOKEN` in your `.env`
5. Scroll to **"Privileged Gateway Intents"** and enable:
   - ✅ **Message Content Intent**
   - ✅ **Server Members Intent** (optional, recommended)
6. Click **"Save Changes"**

**Invite the bot to your server:**

1. Go to **OAuth2** → **URL Generator**
2. Under **Scopes** check `bot`
3. Under **Bot Permissions** check: `Read Messages/View Channels`, `Send Messages`, `Read Message History`
4. Copy the generated URL, paste it in your browser, and select your server

---

### Step 6 — Run Axiom

#### Desktop GUI (recommended)

```bash
npm run app
```

Opens the Electron desktop app with a clean dark-mode chat interface. Sessions are persisted between restarts.

#### Terminal REPL

```bash
npm run desktop
```

A polished interactive terminal chat with spinner, ANSI colours, and built-in commands (`clear`, `help`, `exit`).

#### Discord bot mode

```bash
npm start
```

You should see:

```
🚀 Starting Axiom AI Brain (Discord Mode)...
✅ Axiom is online as Axiom#1234
```

#### HTTP API server

```bash
npm run start:api
```

Starts the REST API on `http://localhost:3000` (set `API_PORT` to override). See [API Reference](#-api-reference) below.

#### Web client

```bash
npm run start:web
```

Serves the web UI at `http://localhost:8080`. Requires the API server to also be running.

#### CLI client

```bash
# Single command
node src/cli.js chat "What is the capital of France?"
node src/cli.js plan "build a Node.js REST API"
node src/cli.js debug "TypeError: Cannot read properties of undefined"
node src/cli.js ship "my SaaS landing page"
node src/cli.js persona coder
node src/cli.js remember name=Alice
node src/cli.js tooltest calculator '{"expression":"15/100*847"}'

# Interactive REPL
node src/cli.js chat
```

#### All services at once (dev)

```bash
npm run dev:all
```

Starts the API server, Discord bot, and web server concurrently with colour-coded output.

---

## 💬 How to Use

### Desktop GUI

Type in the composer at the bottom of the window and press **Enter** (or **Shift+Enter** for a newline). Click a session in the sidebar to switch context, or click **New chat** to start fresh. Tool calls are shown as collapsible pills — click one to expand the raw result.

### Discord

| Context | How to trigger |
|---|---|
| Server channel | `@Axiom <your message>` or start with `axiom <your message>` |
| Direct Message | Just send a message directly to the bot |

**Discord commands:**

| Command | Description |
|---|---|
| `!clear` / `axiom clear` | Reset conversation history |
| `!plan <task>` | Generate a structured plan |
| `!debug <problem>` | Root cause analysis + fixes |
| `!ship <project>` | Ship checklist for a project |
| `!build <thing>` | Step-by-step build guide |
| `!persona [name]` | Show or set persona (concise/detailed/coder/coach/roast) |
| `!remember key=value` | Store a persistent memory |
| `!tooltest [name] [json]` | Directly test a tool |

### Terminal REPL

Type and press **Enter**. Built-in commands:

| Command | Action |
|---|---|
| `clear` | Reset conversation history |
| `help` | Show available commands and example prompts |
| `exit` | Quit Axiom |

### Example prompts

```
What is 15% of 847?
What time is it in Tokyo?
Remind me in 5 minutes to take a break
Define the word "ephemeral"
Tell me a programming joke
Flip a coin / Roll a d20
Convert 100 miles to km
What's the weather in London?
Search for the latest news on Rust programming
Show my system info
Read ~/Documents/notes.txt
Write and run Python code to print the first 20 prime numbers
Run: ls -la ~ and tell me what's in my home folder
Find all .js files in my home folder and count them
clear          ← resets conversation history
```

---

## 🌐 API Reference

Base URL: `http://localhost:3000` (set `API_PORT` to override)

### `GET /health`
Returns server status, version, and uptime.

### `POST /chat`
Send a message and get a response.

```json
// Request
{ "channelId": "my-session", "message": "What is 15% of 847?", "userId": "alice" }

// Response
{ "reply": "127.05" }
```

- `channelId` (required) — identifies the conversation session
- `message` (required) — the user's message
- `userId` (optional) — enables per-user persona + memory injection

### `GET /tools`
List all registered tools.

### `POST /tools/execute`
Directly invoke a tool without going through the LLM.

```json
// Request
{ "name": "calculator", "params": { "expression": "2 + 2" } }

// Response
{ "result": "4" }
```

### Memory endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/memory/:userId` | List all memories |
| `GET` | `/memory/:userId/profile` | Get user profile (persona, etc.) |
| `PUT` | `/memory/:userId/persona` | Set persona `{ "persona": "coder" }` |
| `GET` | `/memory/:userId/:key` | Get a single memory |
| `PUT` | `/memory/:userId/:key` | Set a memory `{ "value": "..." }` |
| `DELETE` | `/memory/:userId/:key` | Delete a memory |

---

## 🎭 Personas

Personas change how Axiom responds. Set them per-user and they persist across sessions.

| Persona | Description |
|---|---|
| `concise` (default) | Brief and direct — one or two sentences |
| `detailed` | Thorough, structured answers with bullet points |
| `coder` | Code-first responses, fenced blocks, technical tone |
| `coach` | Encouraging, educational, explains the "why" |
| `roast` | Witty and irreverent — still helpful, but snarky |

**Set persona:**
- Discord: `!persona coder`
- CLI: `axiom persona coder`
- API: `PUT /memory/:userId/persona` `{"persona":"coder"}`
- Web: dropdown in the header

---

## 💾 Memory & Profiles

Per-user memory is stored in SQLite at `~/.axiom/axiom.db` (override with `DB_PATH`).

**Store a memory:**
- Discord: `!remember project=Axiom`
- CLI: `axiom remember project=Axiom`
- API: `PUT /memory/alice/project` `{"value":"Axiom"}`

Memories are automatically injected into every prompt for that user, so Axiom always has context about them.

---

Tools live in `src/tools/`. Adding a new one takes ~10 lines:

1. **Create** `src/tools/myTool.js`:

```js
export const myTool = {
  name: "my_tool",
  description: "What this tool does — Gemini reads this to decide when to call it.",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "The input parameter." },
    },
    required: ["input"],
  },
  execute({ input }) {
    return `You said: ${input}`;
  },
};
```

2. **Register** it in `src/tools/index.js`:

```js
import { myTool } from "./myTool.js";

export const tools = [...existingTools, myTool];
```

That's it! Gemini will automatically discover and use the new tool based on the `description`.

---

## 🌿 Environment Variables Reference

### Provider settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | ✅ *(recommended)* | — | OpenRouter API key — takes priority when set |
| `OPENROUTER_MODEL` | ❌ | `google/gemini-2.0-flash-exp:free` | Model slug (see [openrouter.ai/models](https://openrouter.ai/models)) |
| `OPENROUTER_BASE_URL` | ❌ | `https://openrouter.ai/api/v1` | Override OpenRouter endpoint |
| `PROVIDER_MAX_RETRIES` | ❌ | `3` | Max retries on 429 / 5xx |
| `PROVIDER_RETRY_BASE_MS` | ❌ | `1000` | Base delay (ms) for exponential backoff |
| `GOOGLE_AI_API_KEY` | ✅ *(if no OR key)* | — | Google AI Studio key — used as fallback |
| `GOOGLE_AI_MODEL` | ❌ | `gemini-2.0-flash` | Gemini model when falling back to Google |

### General settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `MODE` | ❌ | `discord` | Run mode: `discord`, `desktop`, or `api` |
| `API_PORT` | ❌ | `3000` | Port for the HTTP API server |
| `WEB_PORT` | ❌ | `8080` | Port for the static web client server |
| `DB_PATH` | ❌ | `~/.axiom/axiom.db` | Path to the SQLite database file |
| `CLI_USER_ID` | ❌ | `cli-user` | User ID for CLI memory/persona storage |
| `DISCORD_TOKEN` | ✅ (discord) | — | Your Discord bot token |
| `DISCORD_CLIENT_ID` | ❌ | — | Discord application ID (for slash commands) |
| `SYSTEM_PROMPT` | ❌ | _built-in_ | AI personality / system instruction |
| `RESPONSE_VERBOSITY` | ❌ | `concise` | Reply length: `concise` or `detailed` |
| `MAX_TOOL_ROUNDS` | ❌ | `5` | Max tool-call iterations per message |
| `MAX_HISTORY_TURNS` | ❌ | `20` | Max conversation turns kept in memory per session |
| `OWNER_ID` | ❌ | — | Discord user ID that always has access |
| `ALLOWED_USER_IDS` | ❌ | — | Comma-separated user IDs allowed to use the bot |
| `ALLOWED_GUILD_IDS` | ❌ | — | Comma-separated server IDs where the bot responds |

---

## 🔁 Google AI Studio fallback

If you prefer to use Google AI Studio directly (or as a backup), leave `OPENROUTER_API_KEY` blank and set:

```env
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
GOOGLE_AI_MODEL=gemini-2.0-flash
```

Axiom automatically selects the Google AI Studio provider when no OpenRouter key is configured.

---

## 📦 Migrating from Google AI Studio

If you were using an earlier version of Axiom that required `GOOGLE_AI_API_KEY`:

1. Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Add to `.env`:
   ```env
   OPENROUTER_API_KEY=your_key_here
   OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
   ```
3. You can leave your `GOOGLE_AI_API_KEY` in place — it becomes the fallback and is ignored when `OPENROUTER_API_KEY` is set.

No code changes are needed. The bot, desktop GUI, terminal REPL, API, and CLI all work identically with either provider.

## 📦 Migrating from Discord-only to Multi-client

If you were running Axiom only as a Discord bot:

1. **No breaking changes** — your Discord bot continues to work exactly as before.
2. **To add the API server**, run `npm run start:api` (or `MODE=api npm start`).
3. **To add the web client**, run `npm run start:web` with the API server running.
4. **To use the CLI**, run `node src/cli.js chat`.
5. **Memory and personas** are stored in `~/.axiom/axiom.db` automatically — nothing to configure.
6. **To run everything at once**: `npm run dev:all`.

New `package.json` scripts summary:

| Script | What it does |
|---|---|
| `npm start` | Discord bot (default, unchanged) |
| `npm run start:api` | HTTP API server |
| `npm run start:cli` | CLI REPL |
| `npm run start:web` | Static web client server |
| `npm run dev:all` | All services concurrently |
| `npm test` | Run all tests |

---

## 🔒 Privacy & Access Control

By default Axiom responds to anyone in any server it is invited to. You can lock it down using three optional environment variables:

| Variable | What it controls |
|---|---|
| `OWNER_ID` | Your Discord user ID — always has access, bypasses all other checks |
| `ALLOWED_USER_IDS` | Comma-separated list of user IDs permitted to use the bot |
| `ALLOWED_GUILD_IDS` | Comma-separated list of server (guild) IDs where the bot will respond |

**How the rules work:**

1. If `OWNER_ID` is set and matches the message author → always allowed.
2. If `ALLOWED_GUILD_IDS` is set → guild messages from unlisted servers are silently ignored. DMs are not affected by this setting (use `ALLOWED_USER_IDS` to restrict DMs).
3. If `ALLOWED_USER_IDS` is set → only those users can trigger the bot (in any allowed server, plus DMs).
4. Leave any variable empty (or omit it) to skip that restriction.

**Example — personal-use only:**

```env
# Your own Discord user ID (always has access)
OWNER_ID=123456789012345678

# Friends you want to share it with (different IDs from the owner)
ALLOWED_USER_IDS=111111111111111111,222222222222222222

# Only your private server
ALLOWED_GUILD_IDS=333333333333333333
```

> **Tip:** Enable **Developer Mode** in Discord (*Settings → Advanced → Developer Mode*), then right-click any user or server to copy its ID.

---

## 🎙️ Personality & Verbosity

### Verbosity mode

Axiom's response length is controlled by the `RESPONSE_VERBOSITY` environment variable:

```env
# Short, natural replies (default)
RESPONSE_VERBOSITY=concise

# Thorough explanations with steps and context
RESPONSE_VERBOSITY=detailed
```

| Mode | Behaviour |
|---|---|
| `concise` | One or two sentences where possible; no filler or over-explanation |
| `detailed` | Full answers with bullet points and background context |

### Custom personality

Override the base system prompt entirely via `SYSTEM_PROMPT`:

```env
# Chill, casual assistant
SYSTEM_PROMPT=You are Axiom, a chill and witty assistant. Keep it real.

# Formal, professional assistant
SYSTEM_PROMPT=You are Axiom, a professional AI assistant. Be precise and formal at all times.
```

> **Tip:** `RESPONSE_VERBOSITY` stacks on top of your custom `SYSTEM_PROMPT`.

---

## 🗂️ Project Structure

```
Axiom/
├── src/
│   ├── index.js          ← Entry point (mode selector)
│   ├── bot.js            ← Discord bot (message handling)
│   ├── desktop.js        ← Desktop terminal REPL
│   ├── agent.js          ← AI agent loop (OpenRouter primary / Gemini fallback)
│   └── tools/
│       ├── index.js      ← Tool registry
│       ├── calculator.js ← Math evaluator
│       ├── datetime.js   ← Date/time lookup
│       ├── remind.js     ← Reminder timer
│       ├── define.js     ← Dictionary lookup
│       ├── joke.js       ← Random joke fetcher
│       ├── coinflip.js   ← Coin flip / dice roll / random pick
│       └── unitconvert.js← Unit conversion
├── .env                  ← Your environment variables (edit this)
├── .env.example          ← Example / template for .env
├── .gitignore
├── package.json
└── README.md
```

---

## 🛠️ Development Mode (auto-restart on save)

```bash
npm run dev
# or desktop with auto-restart:
MODE=desktop npm run dev
```

---

## 📄 License

MIT

