# Axiom

**Axiom** is an AI agent desktop app — and Discord bot — powered by **[Google AI Studio](https://aistudio.google.com)** (Gemini). It delivers streaming responses, a full tool set (code execution, web search, shell, weather, and more), and a clean minimal UI.

The desktop GUI (`npm run app`) delivers a clean, minimal chat interface with streaming responses, multi-session history, and a growing tool set. The original terminal REPL and Discord bot modes are still fully supported.

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
- A free [Google AI Studio](https://aistudio.google.com) API key
- *(Discord mode only)* A Discord account and a server where you can add bots

---

## 🚀 Setup Guide

### Step 1 — Get a Google AI Studio API key

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API key"** and copy the key

> The free tier of Google AI Studio is generous enough for personal use.  
> You can choose a more powerful model (e.g. `gemini-1.5-pro`) by setting `GOOGLE_AI_MODEL` in your `.env`.

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

# Your Google AI Studio API key
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Model to use (default is fine)
GOOGLE_AI_MODEL=gemini-1.5-flash

# Discord bot token (only needed for MODE=discord)
DISCORD_TOKEN=your_discord_bot_token_here
```

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

| Variable | Required | Default | Description |
|---|---|---|---|
| `MODE` | ❌ | `discord` | Run mode: `discord` or `desktop` |
| `GOOGLE_AI_API_KEY` | ✅ | — | Your Google AI Studio API key |
| `GOOGLE_AI_MODEL` | ❌ | `gemini-1.5-flash` | Gemini model to use |
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
│   ├── agent.js          ← Google AI Studio (Gemini) agent loop
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

