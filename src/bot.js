/**
 * bot.js
 *
 * Sets up the Discord client and handles incoming messages.
 * Routes each message through the AI agent and replies with the result.
 *
 * Special commands (prefix: !  or "axiom <cmd>"):
 *   clear       — reset conversation history
 *   tooltest    — directly test a tool: !tooltest calculator {"expression":"2+2"}
 *   persona     — set/show persona: !persona coder
 *   remember    — store a memory: !remember key=value
 *   plan        — structured plan: !plan <task>
 *   debug       — debug analysis: !debug <problem>
 *   ship        — ship checklist: !ship <project>
 *   build       — build guide: !build <thing>
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  MessageFlags,
} from "discord.js";
import { processMessage, clearHistory, PERSONAS } from "./agent.js";
import {
  getProfile,
  setPersona,
  setMemory,
  getMemories,
  buildMemoryContext,
} from "./db/memory.js";
import { getToolByName, getToolDefinitions } from "./tools/index.js";

/**
 * Parse a comma-separated env var into a Set of trimmed, non-empty strings.
 * @param {string|undefined} value
 * @returns {Set<string>}
 */
function parseIdList(value) {
  if (!value) return new Set();
  return new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
}

/**
 * Returns true if the message author is allowed to use the bot.
 * Rules (all optional — leave env vars blank to disable each restriction):
 *   1. OWNER_ID always passes.
 *   2. ALLOWED_GUILD_IDS: if set, guild messages must come from a listed server.
 *   3. ALLOWED_USER_IDS: if set, the author must be in the list.
 * @param {import("discord.js").Message} message
 * @returns {boolean}
 */
function isAuthorized(message) {
  const ownerId = (process.env.OWNER_ID || "").trim();
  const allowedUsers = parseIdList(process.env.ALLOWED_USER_IDS);
  const allowedGuilds = parseIdList(process.env.ALLOWED_GUILD_IDS);

  // Owner always passes
  if (ownerId && message.author.id === ownerId) return true;

  // Guild restriction — only applies to guild messages, not DMs
  // (To restrict DMs, use ALLOWED_USER_IDS)
  if (allowedGuilds.size > 0 && message.guild) {
    if (!allowedGuilds.has(message.guild.id)) return false;
  }

  // User restriction (applies to both guild and DM messages)
  if (allowedUsers.size > 0) {
    return allowedUsers.has(message.author.id);
  }

  return true;
}

// Discord client with the intents we need
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

/**
 * Called once when the bot successfully connects to Discord.
 */
client.once("ready", (c) => {
  console.log(`✅ Axiom is online as ${c.user.tag}`);
  c.user.setActivity("your commands 🧠", { type: ActivityType.Listening });
});

/**
 * Main message handler.
 */
client.on("messageCreate", async (message) => {
  // Ignore messages from bots (including self)
  if (message.author.bot) return;

  // Access control — silently ignore unauthorized users/servers
  if (!isAuthorized(message)) return;

  const isDM = !message.guild;
  const isMentioned =
    message.mentions.has(client.user) ||
    message.content.toLowerCase().startsWith("axiom") ||
    message.content.startsWith("!");

  // In guilds: only respond when mentioned or when message starts with "axiom"/"!"
  // In DMs: always respond
  if (!isDM && !isMentioned) return;

  // Strip the bot mention prefix to get the clean user input
  let userInput = message.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

  // Strip "axiom" prefix (case-insensitive) if present
  if (userInput.toLowerCase().startsWith("axiom")) {
    userInput = userInput.slice(5).trim();
  }

  const userId = message.author.id;

  // ── Built-in commands ────────────────────────────────────────────────────────

  // !clear / clear
  if (/^!?clear$/i.test(userInput)) {
    clearHistory(message.channelId);
    return message.reply("🧹 Conversation history cleared!");
  }

  // !tooltest [name] [json-params]
  const toolTestMatch = userInput.match(/^!?tooltest(?:\s+(\S+)(?:\s+([\s\S]*))?)?$/i);
  if (toolTestMatch) {
    const toolName  = toolTestMatch[1];
    const rawParams = toolTestMatch[2];
    if (!toolName) {
      const list = getToolDefinitions().map((t) => `\`${t.function.name}\``).join(", ");
      return message.reply(`🔧 Available tools: ${list}`);
    }
    const tool = getToolByName(toolName);
    if (!tool) return message.reply(`❌ Tool \`${toolName}\` not found.`);
    let params = {};
    if (rawParams) {
      try { params = JSON.parse(rawParams); }
      catch { return message.reply("❌ Invalid JSON params."); }
    }
    try {
      await message.channel.sendTyping();
      const t0     = Date.now();
      const result = await Promise.resolve(tool.execute(params, { channelId: message.channelId }));
      const elapsed = Date.now() - t0;
      console.log(`[Tool] ✓ ${toolName}  via Discord !tooltest  (${elapsed}ms)`);
      const out = `🔧 **${toolName}** (${elapsed}ms):\n\`\`\`\n${String(result).slice(0, 1800)}\n\`\`\``;
      return message.reply(out.length <= 2000 ? out : out.slice(0, 2000));
    } catch (err) {
      console.error(`[Tool] ✗ ${toolName}  EXEC_ERROR  ${err.message}`);
      return message.reply(`❌ Tool error: ${err.message}`);
    }
  }

  // !persona [name]
  const personaMatch = userInput.match(/^!?persona(?:\s+(\S+))?$/i);
  if (personaMatch) {
    const name = personaMatch[1];
    if (!name) {
      const profile = getProfile(userId);
      const list    = Object.keys(PERSONAS).map((k) =>
        k === profile.persona ? `**${k}** ✓` : k
      ).join(", ");
      return message.reply(`🎭 Current persona: **${profile.persona}** — Options: ${list}`);
    }
    if (!PERSONAS[name]) {
      return message.reply(`❌ Unknown persona. Options: ${Object.keys(PERSONAS).join(", ")}`);
    }
    setPersona(userId, name);
    return message.reply(`🎭 Persona set to **${name}** — ${PERSONAS[name].label}`);
  }

  // !remember key=value
  const rememberMatch = userInput.match(/^!?remember\s+(.+)$/i);
  if (rememberMatch) {
    const entry = rememberMatch[1].trim();
    const sep   = entry.indexOf("=");
    if (sep === -1) return message.reply("❌ Use format: `!remember key=value`");
    const key   = entry.slice(0, sep).trim();
    const value = entry.slice(sep + 1).trim();
    setMemory(userId, key, value);
    return message.reply(`🧠 Remembered: **${key}** = ${value}`);
  }

  // !plan <task>
  const planMatch = userInput.match(/^!?plan\s+([\s\S]+)$/i);
  if (planMatch) {
    const task = planMatch[1];
    userInput = `Create a detailed, numbered step-by-step plan for the following task: ${task}`;
  }

  // !debug <problem>
  const debugMatch = userInput.match(/^!?debug\s+([\s\S]+)$/i);
  if (debugMatch) {
    const problem = debugMatch[1];
    userInput = `Analyse the following problem and provide root cause analysis and actionable fixes: ${problem}`;
  }

  // !ship <project>
  const shipMatch = userInput.match(/^!?ship\s+([\s\S]+)$/i);
  if (shipMatch) {
    const project = shipMatch[1];
    userInput = `List everything required to ship the following project or feature — including code, tests, docs, deployment, and any blockers: ${project}`;
  }

  // !build <thing>
  const buildMatch = userInput.match(/^!?build\s+([\s\S]+)$/i);
  if (buildMatch) {
    const thing = buildMatch[1];
    userInput = `Provide a step-by-step guide to build: ${thing}`;
  }

  if (!userInput) {
    return message.reply(
      "Hey! I'm **Axiom**, your AI brain 🧠. Ask me anything or give me a task!"
    );
  }

  // Show a typing indicator while we process
  try {
    await message.channel.sendTyping();
  } catch {
    // Non-fatal — just continue without the typing indicator
  }

  try {
    // Build the context with persona + memory
    const profile       = getProfile(userId);
    const persona       = PERSONAS[profile.persona] || PERSONAS.concise;
    const memCtx        = buildMemoryContext(userId);

    const context = {
      userId,
      personaPrompt: persona.instruction,
      memoryContext:  memCtx,
      sendCallback: async (reminderText) => {
        try {
          await message.reply(reminderText);
        } catch {
          try {
            await message.author.send(reminderText);
          } catch {
            console.error("[Bot] Could not deliver reminder.");
          }
        }
      },
    };

    const reply = await processMessage(message.channelId, userInput, context);

    // Discord has a 2000 character message limit — split if needed
    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      const chunks = splitMessage(reply, 2000);
      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }
    }
  } catch (err) {
    console.error("[Bot] Error processing message:", err);
    await message.reply(
      "❌ Something went wrong while thinking. Please try again in a moment."
    );
  }
});

/**
 * Split a long string into chunks no longer than `maxLength`.
 * Tries to split on newlines for readability.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string[]}
 */
function splitMessage(text, maxLength) {
  const chunks = [];
  while (text.length > maxLength) {
    let splitAt = text.lastIndexOf("\n", maxLength);
    if (splitAt === -1) splitAt = maxLength;
    chunks.push(text.slice(0, splitAt));
    text = text.slice(splitAt).trimStart();
  }
  if (text.length > 0) chunks.push(text);
  return chunks;
}

/**
 * Start the bot.
 */
export function startBot() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error("DISCORD_TOKEN is not set. Please check your .env file.");
  }
  return client.login(token);
}
