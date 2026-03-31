/**
 * agent.js
 *
 * Core AI agent loop that:
 *   1. Sends user messages to a local Ollama server.
 *   2. Handles tool-call responses by executing the matching tool.
 *   3. Feeds tool results back to Ollama until a final text response is produced.
 */

import { getToolDefinitions, getToolByName } from "./tools/index.js";

let ollamaEndpoint = null;
let ollamaModel = null;
let systemPrompt = null;
let maxToolRounds = null;
let verbosity = null;

/**
 * Tracks whether the current model has been confirmed to not support tools.
 * Set to true on a "does not support tools" 400 response; resets when model changes.
 */
let modelToolsUnsupported = false;
let lastKnownModel = null;

/**
 * Read Ollama config from environment (lazily, so dotenv is loaded first).
 */
const VERBOSITY_INSTRUCTIONS = {
  concise:
    "Be brief and direct — one or two sentences is ideal. " +
    "Skip preamble, filler phrases ('Great question!', 'Certainly!', 'Of course!'), and unnecessary context. " +
    "Only write more when the topic genuinely requires it.",
  detailed:
    "Give complete, well-structured answers. " +
    "Use bullet points or numbered steps for multi-part topics. " +
    "Include relevant background and context when it adds real value.",
};

const DEFAULT_SYSTEM_PROMPT =
  "You are Axiom — a fast, knowledgeable AI assistant with a direct personality. " +
  "You sound like a smart friend who actually knows their stuff, not a help-desk script. " +
  "Never open with filler phrases like 'Great question!', 'Certainly!', 'Sure!', or 'Of course!'. " +
  "Get straight to the answer. Use tools whenever they give a more accurate result. " +
  "When you don't know something, say so plainly instead of guessing.";

function initConfig() {
  if (ollamaEndpoint === null) {
    ollamaEndpoint =
      (process.env.OLLAMA_ENDPOINT || "http://localhost:11434").replace(/\/$/, "");
    ollamaModel = process.env.OLLAMA_MODEL || "phi3:mini";
    verbosity = (process.env.RESPONSE_VERBOSITY || "concise").toLowerCase();
    if (!VERBOSITY_INSTRUCTIONS[verbosity]) {
      console.warn(
        `[Agent] Unknown RESPONSE_VERBOSITY "${verbosity}" — falling back to "concise".`
      );
      verbosity = "concise";
    }
    const basePrompt = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
    systemPrompt = `${basePrompt}\n\nTone & length: ${VERBOSITY_INSTRUCTIONS[verbosity]}`;
    maxToolRounds = parseInt(process.env.MAX_TOOL_ROUNDS || "5", 10);
  }

  // Reset tool-support tracking whenever the configured model changes.
  if (ollamaModel !== lastKnownModel) {
    lastKnownModel = ollamaModel;
    modelToolsUnsupported = false;
  }
}

/**
 * Send a single chat request to Ollama and return the response message object.
 * @param {Array<object>} messages
 * @param {Array<object>} tools
 * @returns {Promise<object>} Ollama message object { role, content, tool_calls? }
 */
async function ollamaChat(messages, tools) {
  const url = `${ollamaEndpoint}/api/chat`;

  // If the model was already determined not to support tools, skip the tools field.
  const body = {
    model: ollamaModel,
    messages,
    ...(modelToolsUnsupported ? {} : { tools }),
    stream: false,
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Cannot reach Ollama at ${ollamaEndpoint}. Make sure Ollama is running. (${err.message})`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");

    // Gracefully handle models that don't support the tools API:
    // remember this for the session and retry without tools.
    const isToolsUnsupported = (() => {
      if (res.status !== 400) return false;
      try {
        const json = JSON.parse(text);
        return typeof json.error === "string" && json.error.includes("does not support tools");
      } catch {
        return text.includes("does not support tools");
      }
    })();
    if (isToolsUnsupported) {
      console.warn(
        `[Agent] Model "${ollamaModel}" does not support tools — falling back to plain chat.`
      );
      modelToolsUnsupported = true;
      return ollamaChat(messages, []);
    }

    let hint = "";
    if (res.status === 404) {
      hint = ` (Model "${ollamaModel}" may not be pulled — run: ollama pull ${ollamaModel})`;
    } else if (res.status === 400) {
      hint = ` (Bad request — check that the model name "${ollamaModel}" is correct)`;
    } else if (res.status === 500) {
      hint = " (Ollama internal error — check the Ollama server logs)";
    }
    throw new Error(`Ollama returned HTTP ${res.status}${hint}: ${text}`);
  }

  const data = await res.json();
  return data.message; // { role: "assistant", content: "...", tool_calls?: [...] }
}

/**
 * Per-channel conversation history.
 * Key: channelId (string), Value: array of OpenAI-style message objects
 * @type {Map<string, Array<object>>}
 */
const channelHistories = new Map();

/**
 * Process a user message through the Ollama agent loop.
 *
 * @param {string} channelId   - Unique identifier for the conversation channel.
 * @param {string} userMessage - The text the user sent.
 * @param {object} [context]   - Optional context passed to tools (e.g. { sendCallback }).
 * @returns {Promise<string>}  - The final text response to send back to the user.
 */
export async function processMessage(channelId, userMessage, context = {}) {
  initConfig();

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

  const toolDefs = getToolDefinitions();

  // Tool-call loop — up to MAX_TOOL_ROUNDS rounds of tool execution
  for (let round = 0; round < maxToolRounds; round++) {
    const assistantMessage = await ollamaChat(messages, toolDefs);

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
    // Ollama returns tool_calls as: [{ function: { name, arguments: <object> } }]
    for (const toolCall of assistantMessage.tool_calls) {
      const { name, arguments: args } = toolCall.function;
      const argsDisplay =
        typeof args === "string" ? args : JSON.stringify(args);
      console.log(`[Agent] Tool call: ${name}(${argsDisplay})`);

      const tool = getToolByName(name);
      let result;

      if (!tool) {
        result = `Error: tool "${name}" is not registered.`;
      } else {
        // Ollama may pass arguments as an already-parsed object or as a JSON string
        let parsedArgs;
        if (typeof args === "string") {
          try {
            parsedArgs = JSON.parse(args);
          } catch (err) {
            result = `Error parsing arguments for tool "${name}": ${err.message}`;
          }
        } else {
          parsedArgs = args;
        }

        if (parsedArgs !== undefined) {
          try {
            result = await Promise.resolve(tool.execute(parsedArgs, context));
          } catch (err) {
            result = `Error executing tool "${name}": ${err.message}`;
          }
        }
      }

      console.log(`[Agent] Tool result for ${name}: ${result}`);

      // Ollama expects tool results in the "tool" role (no tool_call_id needed)
      messages.push({
        role: "tool",
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
