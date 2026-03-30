# Axiom 🧠

**Axiom** is an AI brain Discord bot **and desktop application** — message it from Discord or from a native desktop window, and it will think, reason, and act using a suite of built-in tools. It is powered by **Groq** (free tier, no credit card needed) and is built with **Node.js + discord.js + Electron**.

---

## ✨ Features

| Feature | Details |
|---|---|
| 💬 Discord Integration | Mention `@Axiom` in a server, or DM it directly |
| 🖥️ Desktop App | Native chat window (Windows, macOS, Linux) via Electron |
| 🧠 AI Conversations | Full multi-turn conversation memory per channel / session |
| 🔧 Tool / Agent Loop | Groq calls tools automatically to complete tasks |
| 📊 Tool Activity Log | Desktop sidebar shows every tool call and result live |
| 🔢 Calculator | Evaluate any math expression |
| 🕐 Date & Time | Get the current date/time in any timezone |
| ⏰ Reminders | "Remind me in 10 minutes to drink water" |
| 📖 Word Definitions | Look up any English word |
| ➕ Extensible | Add your own tools in minutes (see below) |

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer  
- A **Groq API key** (free — no credit card required)  
- *(Discord mode only)* A **Discord account** and a server where you have permission to add bots  

---

## 🚀 Setup Guide

### Step 1 — Clone / Download the project

```bash
git clone https://github.com/kickxly-dev/Axiom.git
cd Axiom
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Get your FREE Groq API key

1. Go to [https://console.groq.com/keys](https://console.groq.com/keys)
2. Sign up or sign in (no credit card required)
3. Click **"Create API Key"**
4. Copy the key — you will need it in Step 5

> **Rate limits:** The free tier is very generous for personal use. See [Groq's rate limit docs](https://console.groq.com/docs/rate-limits) for details.

### Step 4 — Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**, give it a name (e.g. `Axiom`)
3. In the left sidebar, click **"Bot"**
4. Click **"Add Bot"** → **"Yes, do it!"**
5. Under **"Token"**, click **"Reset Token"** and copy it — you will need it in Step 5
6. Scroll down to **"Privileged Gateway Intents"** and enable:
   - ✅ **Message Content Intent**
   - ✅ **Server Members Intent** (optional, but recommended)
7. Click **"Save Changes"**

**Invite your bot to your server:**

1. In the left sidebar, click **"OAuth2"** → **"URL Generator"**
2. Under **Scopes**, check `bot`
3. Under **Bot Permissions**, check:
   - `Read Messages/View Channels`
   - `Send Messages`
   - `Read Message History`
4. Copy the generated URL, paste it in your browser, and select your server

### Step 5 — Configure environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env
```

Open `.env` in a text editor and set the following:

```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_application_id_here
GROQ_API_KEY=your_groq_api_key_here
```

> **Where is the Client ID?**  
> In the Discord Developer Portal, open your application → **"General Information"** → copy the **Application ID**.

### Step 6 — Run the bot

```bash
npm start
```

You should see:

```
🚀 Starting Axiom AI Brain...
✅ Axiom is online as Axiom#1234
```

Your bot is now live! Head to Discord and try it out.

---

## 💬 How to Use

| Context | How to trigger |
|---|---|
| Server channel | `@Axiom <your message>` or start with `axiom <your message>` |
| Direct Message | Just send a message directly to the bot |

### Example commands

```
@Axiom what is 15% of 847?
@Axiom what time is it in Tokyo?
@Axiom remind me in 5 minutes to take a break
@Axiom define the word "ephemeral"
@Axiom explain how black holes work
axiom model          ← shows which AI provider and model is being used
axiom clear          ← clears conversation history for this channel
```

---

## 🖥️ Desktop App

Axiom includes a native desktop interface built with [Electron](https://www.electronjs.org/). It gives you a full chat window with a tool-activity sidebar — no Discord account required.

### Launch the desktop app

```bash
npm run desktop
```

That's it! A window will open with the Axiom chat UI.

> **Prerequisite:** You must have `GROQ_API_KEY` set in your `.env` file. `DISCORD_TOKEN` is **optional** for the desktop app.

### Desktop app features

| Feature | Details |
|---|---|
| 💬 Chat window | Send tasks and chat with the AI agent |
| 🔧 Tool activity log | Live sidebar showing every tool call and its result |
| 📊 Connection status | Shows Groq API + Discord bot status |
| 🤖 Start Discord bot | Optional button to also run the Discord bot from within the app |
| ⚙️ Open .env Config | Quick button to open the config file in your editor |

### Platform-specific notes

| OS | Notes |
|---|---|
| **Windows** | Run `npm run desktop` in PowerShell or CMD from the project folder |
| **macOS** | Run `npm run desktop` in Terminal. On first launch you may need to allow the app in *System Settings → Privacy & Security* |
| **Linux** | Run `npm run desktop`. If you see a `--no-sandbox` error, set the environment variable: `ELECTRON_NO_SANDBOX=1 npm run desktop` |

### Development mode (DevTools enabled)

```bash
npm run desktop:dev
```

### Running Discord and Desktop side-by-side

Both modes share the same Groq AI agent but maintain **separate conversation histories**:

| Mode | How to run | Conversation channel |
|---|---|---|
| Discord bot | `npm start` | Per Discord channel / DM |
| Desktop app | `npm run desktop` | Single desktop session |

You can run them **at the same time** — just open two terminals:

```bash
# Terminal 1 — Discord bot
npm start

# Terminal 2 — Desktop app
npm run desktop
```

Alternatively, start the Discord bot **from inside** the desktop app by clicking **"🤖 Start Discord Bot"** in the sidebar.

---

## 🔧 Adding Your Own Tools

Tools live in `src/tools/`. Adding a new one takes ~10 lines:

1. **Create** `src/tools/myTool.js`:

```js
export const myTool = {
  name: "my_tool",
  description: "What this tool does — Groq reads this to decide when to call it.",
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

That's it! Groq will automatically discover and use the new tool based on the `description`.

---

## 🌿 Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISCORD_TOKEN` | ✅ Discord / ❌ Desktop | — | Your Discord bot token |
| `DISCORD_CLIENT_ID` | ❌ | — | Your Discord application ID (needed to register slash commands in the future) |
| `GROQ_API_KEY` | ✅ | — | Groq API key (free) |
| `GROQ_MODEL` | ❌ | `llama3-8b-8192` | Groq model to use (e.g. `mixtral-8x7b-32768`, `llama3-70b-8192`) |
| `SYSTEM_PROMPT` | ❌ | _built-in_ | AI personality / system instruction |
| `MAX_TOOL_ROUNDS` | ❌ | `5` | Max tool-call iterations per message |

---

## 🗂️ Project Structure

```
Axiom/
├── src/
│   ├── index.js          ← Discord bot entry point
│   ├── bot.js            ← Discord bot (message handling)
│   ├── agent.js          ← Groq AI agent loop (shared by Discord & Desktop)
│   └── tools/
│       ├── index.js      ← Tool registry
│       ├── calculator.js ← Math evaluator
│       ├── datetime.js   ← Date/time lookup
│       ├── remind.js     ← Reminder timer
│       └── define.js     ← Dictionary lookup
├── electron/
│   ├── main.cjs          ← Electron main process
│   ├── preload.cjs       ← Contextbridge preload (IPC bridge)
│   └── renderer/
│       ├── index.html    ← Desktop UI
│       ├── style.css     ← Dark-theme styles
│       └── app.js        ← Renderer-side JavaScript
├── .env.example          ← Template for your .env file
├── .gitignore
├── package.json
└── README.md
```

---

## 🛠️ Development Mode (auto-restart on save)

```bash
npm run dev
```

---

## 📄 License

MIT

