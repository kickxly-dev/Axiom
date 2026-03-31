# Axiom

**Axiom** is an AI agent desktop app — and Discord bot — that works with **[OpenRouter](https://openrouter.ai)** (primary, recommended) or **[Google AI Studio](https://aistudio.google.com)** (fallback). It delivers streaming responses, a full tool set (code execution, web search, shell, weather, and more), and a clean minimal UI.

The desktop GUI (`npm run app`) delivers a clean, minimal chat interface with streaming responses, multi-session history, and a growing tool set. The original terminal REPL and Discord bot modes are still fully supported.

> **Migrating from Google AI Studio?** See the [migration notes](#migrating-from-google-ai-studio) below.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🖥️ Desktop GUI | Clean dark-mode Electron app — streaming responses, session sidebar, tool pills |
| 💬 Discord Bot | Mention `@Axiom` in a server, or DM it directly |
| 🎯 Terminal REPL | Polished interactive terminal chat — `npm run desktop` |
| 🧠 AI Conversations | Full multi-turn conversation memory per channel/session |
| ⚡ Streaming | Tokens stream in real-time as the model generates them |
| 🔧 Agent Tool Loop | Gemini calls tools automatically (ReAct pattern) |
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
| ▶️ Code Runner | Write and execute JavaScript or Python 3 code — run_code tool |
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

---

## 💬 How to Use

### Desktop GUI

Type in the composer at the bottom of the window and press **Enter** (or **Shift+Enter** for a newline). Click a session in the sidebar to switch context, or click **New chat** to start fresh. Tool calls are shown as collapsible pills — click one to expand the raw result.

### Discord

| Context | How to trigger |
|---|---|
| Server channel | `@Axiom <your message>` or start with `axiom <your message>` |
| Direct Message | Just send a message directly to the bot |

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

## 🔧 Adding Your Own Tools

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
| `GOOGLE_AI_API_KEY` | ✅ *(if no OR key)* | — | Google AI Studio key — used as fallback |
| `GOOGLE_AI_MODEL` | ❌ | `gemini-2.0-flash` | Gemini model when falling back to Google |

### General settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `MODE` | ❌ | `discord` | Run mode: `discord` or `desktop` |
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

No code changes are needed. The bot, desktop GUI, and terminal REPL all work identically with either provider.

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

