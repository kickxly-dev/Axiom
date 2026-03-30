# Axiom 🧠

**Axiom** is an AI brain Discord bot — and desktop chat app — powered by a **local [Ollama](https://ollama.com)** server running the **phi3:mini** model. No cloud API keys, no monthly bill, completely private.

---

## ✨ Features

| Feature | Details |
|---|---|
| 💬 Discord Integration | Mention `@Axiom` in a server, or DM it directly |
| 🖥️ Desktop Mode | Interactive terminal chat — no Discord required |
| 🧠 AI Conversations | Full multi-turn conversation memory per channel/session |
| 🔧 Tool / Agent Loop | Ollama calls tools automatically to complete tasks (ReAct) |
| 🔢 Calculator | Evaluate any math expression |
| 🕐 Date & Time | Get the current date/time in any timezone |
| ⏰ Reminders | "Remind me in 10 minutes to drink water" |
| 📖 Word Definitions | Look up any English word |
| 🔒 100 % Local | All inference runs on your own machine via Ollama |
| ➕ Extensible | Add your own tools in minutes (see below) |

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- [Ollama](https://ollama.com) installed and running
- *(Discord mode only)* A Discord account and a server where you can add bots

---

## 🚀 Setup Guide

### Step 1 — Install Ollama

#### macOS

```bash
brew install ollama
```

Or download the macOS app from [https://ollama.com/download](https://ollama.com/download).

#### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

#### Windows

Download the Windows installer from [https://ollama.com/download](https://ollama.com/download) and run it.

---

### Step 2 — Download the phi3:mini model

```bash
ollama pull phi3:mini
```

This downloads the ~2 GB quantised model once. Ollama caches it for future use.

> **Want a different model?**  
> You can use any Ollama model that supports tool calling (e.g. `phi3:medium`, `llama3`, `mistral`).  
> Set `OLLAMA_MODEL=<name>` in your `.env` file.

---

### Step 3 — Start the Ollama server

In one terminal window run:

```bash
ollama serve
```

By default Ollama listens on `http://localhost:11434`. Keep this terminal open (or set Ollama to start automatically — the macOS/Windows apps do this for you).

---

### Step 4 — Clone / Download Axiom

```bash
git clone https://github.com/kickxly-dev/Axiom.git
cd Axiom
```

---

### Step 5 — Install Node.js dependencies

```bash
npm install
```

---

### Step 6 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and review the settings. The most important ones are:

```env
# Choose "discord" or "desktop"
MODE=discord

# Ollama server URL (default is fine if you run Ollama locally)
OLLAMA_ENDPOINT=http://localhost:11434

# Model to use — must be pulled with: ollama pull <model>
OLLAMA_MODEL=phi3:mini

# Discord bot token (only needed for MODE=discord)
DISCORD_TOKEN=your_discord_bot_token_here
```

---

### Step 7 — (Discord mode only) Create a Discord Bot

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

### Step 8 — Run Axiom

#### Discord bot mode (default)

```bash
npm start
```

You should see:

```
🚀 Starting Axiom AI Brain (Discord Mode)...
✅ Axiom is online as Axiom#1234
```

#### Desktop / terminal mode

```bash
npm run desktop
# or
MODE=desktop npm start
```

You should see:

```
🚀 Starting Axiom AI Brain (Desktop Mode)...
╔══════════════════════════════════════════╗
║   Axiom 🧠  —  Desktop Mode              ║
║   Type your message and press Enter.     ║
║   Type "clear" to reset conversation.   ║
║   Type "exit" or press Ctrl+C to quit.  ║
╚══════════════════════════════════════════╝

You:
```

---

## 💬 How to Use

### Discord

| Context | How to trigger |
|---|---|
| Server channel | `@Axiom <your message>` or start with `axiom <your message>` |
| Direct Message | Just send a message directly to the bot |

### Desktop

Just type in the terminal and press **Enter**.

### Example commands (both modes)

```
What is 15% of 847?
What time is it in Tokyo?
Remind me in 5 minutes to take a break
Define the word "ephemeral"
Explain how black holes work
clear          ← resets conversation history
```

---

## 🔧 Adding Your Own Tools

Tools live in `src/tools/`. Adding a new one takes ~10 lines:

1. **Create** `src/tools/myTool.js`:

```js
export const myTool = {
  name: "my_tool",
  description: "What this tool does — Ollama reads this to decide when to call it.",
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

export const tools = [calculatorTool, datetimeTool, remindTool, defineTool, myTool];
```

That's it! Ollama will automatically discover and use the new tool based on the `description`.

---

## 🌿 Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `MODE` | ❌ | `discord` | Run mode: `discord` or `desktop` |
| `OLLAMA_ENDPOINT` | ❌ | `http://localhost:11434` | URL of your Ollama server |
| `OLLAMA_MODEL` | ❌ | `phi3:mini` | Ollama model to use (must be pulled first) |
| `DISCORD_TOKEN` | ✅ (discord) | — | Your Discord bot token |
| `DISCORD_CLIENT_ID` | ❌ | — | Discord application ID (for slash commands) |
| `SYSTEM_PROMPT` | ❌ | _built-in_ | AI personality / system instruction |
| `RESPONSE_VERBOSITY` | ❌ | `concise` | Reply length: `concise` or `detailed` |
| `MAX_TOOL_ROUNDS` | ❌ | `5` | Max tool-call iterations per message |

---

## 🎙️ Personality & Verbosity

### Verbosity mode

Axiom's response length is controlled by the `RESPONSE_VERBOSITY` environment variable. Set it in your `.env` file:

```env
# Short, natural replies (default) — like a smart friend texting back
RESPONSE_VERBOSITY=concise

# Thorough explanations with steps and context when needed
RESPONSE_VERBOSITY=detailed
```

| Mode | Behaviour |
|---|---|
| `concise` | One or two sentences where possible; skips filler words and over-explanation |
| `detailed` | Full answers with bullet points and background context when the topic warrants it |

### Custom personality

Override the base system prompt entirely via `SYSTEM_PROMPT` to give Axiom a different name, role, or tone:

```env
# Chill, casual assistant
SYSTEM_PROMPT=You are Axiom, a chill and witty assistant. Keep it real.

# Formal, professional assistant
SYSTEM_PROMPT=You are Axiom, a professional AI assistant. Be precise and formal at all times.
```

> **Tip:** `RESPONSE_VERBOSITY` stacks on top of your custom `SYSTEM_PROMPT`, so you can combine them freely.

---

## 🗂️ Project Structure

```
Axiom/
├── src/
│   ├── index.js          ← Entry point (mode selector)
│   ├── bot.js            ← Discord bot (message handling)
│   ├── desktop.js        ← Desktop terminal REPL
│   ├── agent.js          ← Ollama AI agent loop
│   └── tools/
│       ├── index.js      ← Tool registry
│       ├── calculator.js ← Math evaluator
│       ├── datetime.js   ← Date/time lookup
│       ├── remind.js     ← Reminder timer
│       └── define.js     ← Dictionary lookup
├── .env.example          ← Template for your .env file
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

