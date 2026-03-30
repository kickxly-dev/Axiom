/**
 * agent.js
 *
 * Core AI agent loop that:
 *   1. Sends user messages to Google Gemini.
 *   2. Handles function-call responses by executing the matching tool.
 *   3. Feeds tool results back to Gemini until a final text response is produced.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFunctionDeclarations, getToolByName } from "./tools/index.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  "You are Axiom, a highly intelligent AI assistant and agent. You are helpful, concise, and proactive. When users ask you to do something, you use available tools to fulfill their request. Always explain what you are doing.";
const MAX_TOOL_ROUNDS = parseInt(process.env.MAX_TOOL_ROUNDS || "5", 10);

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set. Please check your .env file.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Build a Gemini model instance with function declarations wired up.
 */
function buildModel() {
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: getFunctionDeclarations() }],
  });
}

/**
 * Per-channel conversation history.
 * Key: channelId (string), Value: Gemini chat history array
 * @type {Map<string, Array<object>>}
 */
const channelHistories = new Map();

/**
 * Process a user message through the Gemini agent loop.
 *
 * @param {string} channelId   - Unique identifier for the conversation channel.
 * @param {string} userMessage - The text the user sent.
 * @param {object} [context]   - Optional context passed to tools (e.g. { sendCallback }).
 * @returns {Promise<string>}  - The final text response to send back to the user.
 */
export async function processMessage(channelId, userMessage, context = {}) {
  const model = buildModel();

  // Retrieve or create per-channel history
  if (!channelHistories.has(channelId)) {
    channelHistories.set(channelId, []);
  }
  const history = channelHistories.get(channelId);

  const chat = model.startChat({ history });

  let response = await chat.sendMessage(userMessage);

  // Tool-call loop
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const candidate = response.response.candidates?.[0];
    if (!candidate) break;

    // Collect any function calls from this response
    const functionCalls = candidate.content?.parts?.filter(
      (p) => p.functionCall
    );

    if (!functionCalls || functionCalls.length === 0) {
      // No more tool calls — we have our final answer
      break;
    }

    // Execute all requested tools and build function response parts
    const functionResponseParts = [];

    for (const part of functionCalls) {
      const { name, args } = part.functionCall;
      console.log(`[Agent] Tool call: ${name}(${JSON.stringify(args)})`);

      const tool = getToolByName(name);
      let result;

      if (!tool) {
        result = `Error: tool "${name}" is not registered.`;
      } else {
        try {
          result = await Promise.resolve(tool.execute(args, context));
        } catch (err) {
          result = `Error executing tool "${name}": ${err.message}`;
        }
      }

      console.log(`[Agent] Tool result for ${name}: ${result}`);

      functionResponseParts.push({
        functionResponse: {
          name,
          response: { output: result },
        },
      });
    }

    // Send tool results back to the model
    response = await chat.sendMessage(functionResponseParts);
  }

  // Persist updated history for this channel
  channelHistories.set(channelId, await chat.getHistory());

  // Extract and return the final text
  const text = response.response.text();
  return text || "_(No response generated)_";
}

/**
 * Clear the conversation history for a channel.
 * @param {string} channelId
 */
export function clearHistory(channelId) {
  channelHistories.delete(channelId);
}
