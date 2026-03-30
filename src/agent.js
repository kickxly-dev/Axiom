/**
 * agent.js
 *
 * Core AI agent loop that:
 *   1. Sends user messages to Groq.
 *   2. Handles tool-call responses by executing the matching tool.
 *   3. Feeds tool results back to Groq until a final text response is produced.
 */

import Groq from "groq-sdk";
import { getToolDefinitions, getToolByName } from "./tools/index.js";

/** @type {Groq | null} */
let groq = null;
let groqModel = null;
let systemPrompt = null;
let maxToolRounds = null;

/**
 * Lazily initialise (and cache) the Groq client so that `process.env` is
 * read after dotenv has had a chance to populate it, not at module-load time.
 * @returns {Groq}
 */
function getGroqClient() {
  if (!groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set. Please check your .env file.");
    }
    groq = new Groq({ apiKey });
    groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    systemPrompt =
      process.env.SYSTEM_PROMPT ||
      "You are Axiom, a highly intelligent AI assistant and agent. You are helpful, concise, and proactive. When users ask you to do something, you use available tools to fulfill their request. Always explain what you are doing.";
    maxToolRounds = parseInt(process.env.MAX_TOOL_ROUNDS || "5", 10);
  }
  return groq;
}

/**
 * Per-channel conversation history.
 * Key: channelId (string), Value: array of OpenAI-style message objects
 * @type {Map<string, Array<object>>}
 */
const channelHistories = new Map();

/**
 * Process a user message through the Groq agent loop.
 *
 * @param {string} channelId   - Unique identifier for the conversation channel.
 * @param {string} userMessage - The text the user sent.
 * @param {object} [context]   - Optional context passed to tools (e.g. { sendCallback }).
 * @returns {Promise<string>}  - The final text response to send back to the user.
 */
export async function processMessage(channelId, userMessage, context = {}) {
  const client = getGroqClient();

  // Retrieve or create per-channel history
  if (!channelHistories.has(channelId)) {
    channelHistories.set(channelId, []);
  }
  const history = channelHistories.get(channelId);

  // Append the new user message to history
  history.push({ role: "user", content: userMessage });

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
  ];

  // Tool-call loop — up to MAX_TOOL_ROUNDS rounds of tool execution
  for (let round = 0; round < maxToolRounds; round++) {
    const response = await client.chat.completions.create({
      model: groqModel,
      messages,
      tools: getToolDefinitions(),
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // Append assistant's response to the running messages list
    messages.push(assistantMessage);

    // If no tool calls, we have the final answer
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      // Persist the updated history (excluding the system prompt)
      channelHistories.set(channelId, messages.slice(1));
      return assistantMessage.content || "_(No response generated)_";
    }

    // Execute each tool call and append results
    for (const toolCall of assistantMessage.tool_calls) {
      const { name, arguments: argsJson } = toolCall.function;
      console.log(`[Agent] Tool call: ${name}(${argsJson})`);

      const tool = getToolByName(name);
      let result;

      if (!tool) {
        result = `Error: tool "${name}" is not registered.`;
      } else {
        let args;
        try {
          args = JSON.parse(argsJson);
        } catch (err) {
          result = `Error parsing arguments for tool "${name}": ${err.message}`;
        }
        if (args !== undefined) {
          try {
            result = await Promise.resolve(tool.execute(args, context));
          } catch (err) {
            result = `Error executing tool "${name}": ${err.message}`;
          }
        }
      }

      console.log(`[Agent] Tool result for ${name}: ${result}`);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: String(result),
      });
    }
  }

  // Fallback: max tool rounds exhausted without a final text response
  channelHistories.set(channelId, messages.slice(1));
  return "_(Max tool rounds reached without a final response)_";
}

/**
 * Clear the conversation history for a channel.
 * @param {string} channelId
 */
export function clearHistory(channelId) {
  channelHistories.delete(channelId);
}
