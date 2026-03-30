# Axiom 🧠

**Axiom** is an AI brain Discord bot — message it from Discord, and it will think, reason, and act using a suite of built-in tools. It is powered by **Groq** (free tier, no credit card needed) and is built with **Node.js + discord.js**.

---

## ✨ Features

| Feature | Details |
|---|---|
| 💬 Discord Integration | Mention `@Axiom` in a server, or DM it directly |
| 🧠 AI Conversations | Full multi-turn conversation memory per channel |
| 🔧 Tool / Agent Loop | Groq calls tools automatically to complete tasks |
| 🔢 Calculator | Evaluate any math expression |
| 🕐 Date & Time | Get the current date/time in any timezone |
| 🌤️ Weather | Live weather for any city (no API key needed) |
| 🔍 Web Search | Search the web via DuckDuckGo (no API key needed) |
| ⏰ Reminders | "Remind me in 10 minutes to drink water" |
| 📖 Word Definitions | Look up any English word |
| ➕ Extensible | Add your own tools in minutes (see below) |

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer  
- A **Discord account** and a Discord server where you have permission to add bots  
- A **Groq API key** (free — no credit card required)

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
@Axiom what's the weather in London?
@Axiom search for the latest news about AI
@Axiom remind me in 5 minutes to take a break
@Axiom define the word "ephemeral"
@Axiom explain how black holes work
axiom clear          ← clears conversation history for this channel
```

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
| `DISCORD_TOKEN` | ✅ | — | Your Discord bot token |
| `DISCORD_CLIENT_ID` | ❌ | — | Your Discord application ID (needed to register slash commands in the future) |
| `GROQ_API_KEY` | ✅ | — | Groq API key (free) |
| `GROQ_MODEL` | ❌ | `llama-3.3-70b-versatile` | Groq model to use (e.g. `llama-3.1-8b-instant` for faster responses) |
| `SYSTEM_PROMPT` | ❌ | _built-in_ | AI personality / system instruction |
| `MAX_TOOL_ROUNDS` | ❌ | `5` | Max tool-call iterations per message |

---

## 🗂️ Project Structure

```
Axiom/
├── src/
│   ├── index.js          ← Entry point
│   ├── bot.js            ← Discord bot (message handling)
│   ├── agent.js          ← Groq AI agent loop
│   └── tools/
│       ├── index.js      ← Tool registry
│       ├── calculator.js ← Math evaluator
│       ├── datetime.js   ← Date/time lookup
│       ├── webSearch.js  ← DuckDuckGo web search
│       ├── weather.js    ← Live weather (Open-Meteo)
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
```

---

## 📄 License

MIT

