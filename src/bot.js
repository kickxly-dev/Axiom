/**
 * bot.js
 *
 * Sets up the Discord client and handles incoming messages.
 * Routes each message through the AI agent and replies with the result.
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  MessageFlags,
} from "discord.js";
import { processMessage, clearHistory } from "./agent.js";

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

  const isDM = !message.guild;
  const isMentioned =
    message.mentions.has(client.user) ||
    message.content.toLowerCase().startsWith("axiom");

  // In guilds: only respond when mentioned or when message starts with "axiom"
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

  // Handle the !clear / "axiom clear" command
  if (userInput.toLowerCase() === "clear") {
    clearHistory(message.channelId);
    return message.reply("🧹 Conversation history cleared!");
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
    // Build the context (sendCallback lets the remind tool DM the user)
    const context = {
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
