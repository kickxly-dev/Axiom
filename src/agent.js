/**
 * agent.js
 *
 * Core AI agent loop powered by Google AI Studio (Gemini).
 *   1. Sends user messages to Google AI Studio.
 *   2. Handles function-call responses by executing the matching tool.
 *   3. Feeds tool results back until a final text response is produced.
 */

import { getToolDefinitions, getToolByName } from "./tools/index.js";
import { clearChannelNotes } from "./tools/notes.js";

let googleApiKey    = null;
let googleModel     = null;
let systemPrompt    = null;
let maxToolRounds   = null;
let maxHistoryTurns = null;
let verbosity       = null;

/**
 * Read Google AI Studio config from environment (lazily, so dotenv is loaded first).
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
  "You are Axiom — an AI agent that reasons, plans, and acts. " +
  "You have tools that let you run code, execute shell commands, search the web, " +
  "check weather, read files, do math, save notes, and more. " +
  "When the user asks you to do something, use your tools — don't just describe what could be done. " +
  "For anything computational, write and run actual code with run_code instead of estimating. " +
  "For multi-step tasks, chain tools together across rounds: save intermediate results to notes, " +
  "then build on them. Plan first when the task is complex, then execute step by step. " +
  "Never say you can't do something without trying your tools first. " +
  "Be direct and action-oriented. Get straight to results.";

function initConfig() {
  if (googleApiKey === null) {
    googleApiKey = process.env.GOOGLE_AI_API_KEY || "";
    googleModel  = process.env.GOOGLE_AI_MODEL   || "gemini-1.5-flash";
    verbosity    = (process.env.RESPONSE_VERBOSITY || "concise").toLowerCase();
    if (!VERBOSITY_INSTRUCTIONS[verbosity]) {
      console.warn(
        `[Agent] Unknown RESPONSE_VERBOSITY "${verbosity}" — falling back to "concise".`
      );
      verbosity = "concise";
    }
    const basePrompt = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
    systemPrompt = `${basePrompt}\n\nTone & length: ${VERBOSITY_INSTRUCTIONS[verbosity]}`;
    maxToolRounds   = parseInt(process.env.MAX_TOOL_ROUNDS    || "5",  10);
    maxHistoryTurns = parseInt(process.env.MAX_HISTORY_TURNS  || "20", 10);
    if (!googleApiKey) {
      console.warn("[Agent] GOOGLE_AI_API_KEY is not set — requests will fail.");
    }
  }
}

// ── Format conversion ─────────────────────────────────────────────────────────

/**
 * Convert the internal OpenAI-style message array to Gemini API format.
 *
 * Rules:
 *  - The optional leading system message → system_instruction
 *  - user  → { role: "user",  parts: [{ text }] }
 *  - assistant (no tools) → { role: "model", parts: [{ text }] }
 *  - assistant (tool_calls) → { role: "model", parts: [{ functionCall }…] }
 *    followed by the immediately subsequent "tool" messages →
 *    { role: "user", parts: [{ functionResponse }…] }
 *
 * @param {Array<object>} messages
 * @returns {{ systemInstruction: string|null, contents: Array<object> }}
 */
function toGeminiContents(messages) {
  let systemInstruction = null;
  const contents        = [];
  let   i               = 0;

  if (messages[0]?.role === "system") {
    systemInstruction = messages[0].content;
    i = 1;
  }

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.content || "" }] });
      i++;

    } else if (msg.role === "assistant") {
      if (msg.tool_calls?.length) {
        // Emit functionCall parts for each tool the model requested
        const callParts = msg.tool_calls.map((tc) => ({
          functionCall: {
            name: tc.function.name,
            args: typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : (tc.function.arguments || {}),
          },
        }));
        contents.push({ role: "model", parts: callParts });

        // Collect the immediately-following tool-result messages and bundle
        // them into a single user turn with functionResponse parts.
        i++;
        const responseParts = [];
        let   tcIdx         = 0;
        while (i < messages.length && messages[i].role === "tool") {
          const tcName = msg.tool_calls[tcIdx]?.function?.name || `tool_${tcIdx}`;
          responseParts.push({
            functionResponse: {
              name:     tcName,
              response: { output: messages[i].content },
            },
          });
          tcIdx++;
          i++;
        }
        if (responseParts.length > 0) {
          contents.push({ role: "user", parts: responseParts });
        }

      } else {
        contents.push({ role: "model", parts: [{ text: msg.content || "" }] });
        i++;
      }

    } else {
      i++; // skip unexpected roles (e.g. orphaned "tool" messages)
    }
  }

  return { systemInstruction, contents };
}

/**
 * Parse a Gemini API response into an OpenAI-style message object.
 *
 * @param {object} data  Parsed JSON from Google AI
 * @returns {{ role: "assistant", content: string, tool_calls?: Array }}
 */
function parseGeminiResponse(data) {
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(
      blockReason
        ? `Request blocked by Google AI: ${blockReason}`
        : "No candidates in Google AI response"
    );
  }

  const parts      = candidate.content?.parts || [];
  let   content    = "";
  const tool_calls = [];

  for (const part of parts) {
    if (part.text) {
      content += part.text;
    } else if (part.functionCall) {
      tool_calls.push({
        function: {
          name:      part.functionCall.name,
          arguments: part.functionCall.args || {},
        },
      });
    }
  }

  return {
    role: "assistant",
    content,
    ...(tool_calls.length > 0 ? { tool_calls } : {}),
  };
}

/**
 * Build the Gemini API request body shared by both streaming and non-streaming.
 *
 * @param {Array<object>} messages  OpenAI-style messages (system may be at index 0)
 * @param {Array<object>} tools     Tool definitions from getToolDefinitions()
 * @returns {object}
 */
function buildGeminiBody(messages, tools) {
  const { systemInstruction, contents } = toGeminiContents(messages);

  const functionDeclarations = tools
    .filter((t) => t.type === "function")
    .map((t) => ({
      name:        t.function.name,
      description: t.function.description,
      parameters:  t.function.parameters,
    }));

  return {
    contents,
    ...(systemInstruction
      ? { system_instruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    ...(functionDeclarations.length > 0
      ? { tools: [{ function_declarations: functionDeclarations }] }
      : {}),
  };
}

/**
 * Send a single chat request to Google AI Studio and return the response.
 *
 * @param {Array<object>} messages
 * @param {Array<object>} tools
 * @returns {Promise<{ role: "assistant", content: string, tool_calls?: Array }>}
 */
async function geminiChat(messages, tools) {
  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent`;
  const body = buildGeminiBody(messages, tools);

  let res;
  try {
    res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":   "application/json",
        "x-goog-api-key": googleApiKey,
      },
      body:    JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Cannot reach Google AI Studio: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let hint = "";
    if (res.status === 400) {
      hint = " (Bad request — check your GOOGLE_AI_MODEL name)";
    } else if (res.status === 403) {
      hint = " (Forbidden — check that GOOGLE_AI_API_KEY is valid)";
    } else if (res.status === 429) {
      hint = " (Rate limited — too many requests to Google AI Studio)";
    } else if (res.status === 500 || res.status === 503) {
      hint = " (Google AI Studio server error — please try again)";
    }
    throw new Error(`Google AI Studio returned HTTP ${res.status}${hint}: ${text}`);
  }

  const data = await res.json();
  return parseGeminiResponse(data);
}

// ── History ───────────────────────────────────────────────────────────────────

/**
 * Per-channel conversation history.
 * Key: channelId (string), Value: array of OpenAI-style message objects
 * @type {Map<string, Array<object>>}
 */
const channelHistories = new Map();

/**
 * Prune a history array to at most `maxTurns` user-initiated exchanges.
 * Finds the start of the (maxTurns)-th-from-the-end user message and slices
 * from there, so we never cut in the middle of a tool-call sequence.
 *
 * @param {Array<object>} history
 * @param {number} maxTurns  0 = no pruning
 * @returns {Array<object>}
 */
function pruneHistory(history, maxTurns) {
  if (maxTurns <= 0) return history;

  let userCount = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      userCount++;
      if (userCount === maxTurns) {
        return history.slice(i);
      }
    }
  }
  return history; // fewer than maxTurns user messages — keep everything
}

/**
 * Process a user message through the Google AI Studio agent loop.
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
    const assistantMessage = await geminiChat(messages, toolDefs);

    // Append assistant's response to the running messages list
    messages.push(assistantMessage);

    // If no tool calls, we have the final answer
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      // Persist the updated history (excluding the system prompt), pruned to maxHistoryTurns
      channelHistories.set(channelId, pruneHistory(messages.slice(1), maxHistoryTurns));
      return assistantMessage.content || "_(No response generated)_";
    }

    // Execute each tool call and append results
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
            result = await Promise.resolve(tool.execute(parsedArgs, { channelId, ...context }));
          } catch (err) {
            result = `Error executing tool "${name}": ${err.message}`;
          }
        }
      }

      console.log(`[Agent] Tool result for ${name}: ${result}`);

      messages.push({
        role: "tool",
        content: String(result),
      });
    }
  }

  // Fallback: max tool rounds exhausted without a final text response
  channelHistories.set(channelId, pruneHistory(messages.slice(1), maxHistoryTurns));
  return "_(Max tool rounds reached without a final response)_";
}

/**
 * Clear the conversation history and per-channel notes for a channel.
 * @param {string} channelId
 */
export function clearHistory(channelId) {
  channelHistories.delete(channelId);
  clearChannelNotes(channelId);
}

// ── Streaming support ─────────────────────────────────────────────────────────

/**
 * Async generator that streams SSE chunks from Google AI Studio.
 * Each yielded value is a normalised chunk: { content?: string, tool_calls?: Array }
 *
 * @param {Array<object>} messages
 * @param {Array<object>} tools
 * @yields {{ content: string, tool_calls?: Array }}
 */
async function* geminiChatStream(messages, tools) {
  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:streamGenerateContent?alt=sse`;
  const body = buildGeminiBody(messages, tools);

  let res;
  try {
    res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":   "application/json",
        "x-goog-api-key": googleApiKey,
      },
      body:    JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Cannot reach Google AI Studio: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let hint = "";
    if (res.status === 400) {
      hint = " (Bad request — check your GOOGLE_AI_MODEL name)";
    } else if (res.status === 403) {
      hint = " (Forbidden — check that GOOGLE_AI_API_KEY is valid)";
    } else if (res.status === 429) {
      hint = " (Rate limited — too many requests to Google AI Studio)";
    }
    throw new Error(`Google AI Studio returned HTTP ${res.status}${hint}: ${text}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep any incomplete trailing line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6); // strip "data: " prefix
        if (jsonStr === "[DONE]") return;
        try {
          const chunk     = JSON.parse(jsonStr);
          const candidate = chunk.candidates?.[0];
          if (!candidate) continue;

          const parts      = candidate.content?.parts || [];
          let   text       = "";
          const tool_calls = [];

          for (const part of parts) {
            if (part.text) {
              text += part.text;
            } else if (part.functionCall) {
              tool_calls.push({
                function: {
                  name:      part.functionCall.name,
                  arguments: part.functionCall.args || {},
                },
              });
            }
          }

          yield {
            content:    text,
            tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
          };

          // Stop streaming once the model signals it is done
          if (
            candidate.finishReason &&
            candidate.finishReason !== "STOP" &&
            candidate.finishReason !== "MAX_TOKENS"
          ) {
            console.warn(
              `[Agent] Gemini stream ended with finishReason="${candidate.finishReason}"`
            );
            return;
          }
        } catch {
          // ignore malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Process a user message through the Google AI Studio agent loop, streaming
 * response tokens back to the caller via context callbacks.
 *
 * @param {string} channelId    - Unique identifier for the conversation channel.
 * @param {string} userMessage  - The text the user sent.
 * @param {object} [context]    - Optional context object:
 *   - onChunk(text)            — called for each streamed text token
 *   - onToolCall(name, args)   — called when the model invokes a tool
 *   - onToolResult(name, res)  — called after a tool finishes executing
 *   - sendCallback             — legacy reminder delivery callback
 * @returns {Promise<string>}   - The complete final text response.
 */
export async function processMessageStream(channelId, userMessage, context = {}) {
  initConfig();

  if (!channelHistories.has(channelId)) {
    channelHistories.set(channelId, []);
  }
  const history = channelHistories.get(channelId);
  history.push({ role: "user", content: userMessage });

  const messages  = [{ role: "system", content: systemPrompt }, ...history];
  const toolDefs  = getToolDefinitions();

  for (let round = 0; round < maxToolRounds; round++) {
    let fullContent = "";
    let toolCalls   = null;

    // Stream this round's response
    for await (const chunk of geminiChatStream(messages, toolDefs)) {
      if (chunk.content) {
        fullContent += chunk.content;
        // Only forward content chunks when no tool call is pending
        if (!toolCalls) {
          context.onChunk?.(chunk.content);
        }
      }

      if (chunk.tool_calls?.length) {
        toolCalls = chunk.tool_calls;
      }
    }

    const assistantMessage = {
      role:    "assistant",
      content: fullContent,
      ...(toolCalls ? { tool_calls: toolCalls } : {}),
    };
    messages.push(assistantMessage);

    // No tool calls → this is the final response
    if (!toolCalls || toolCalls.length === 0) {
      channelHistories.set(channelId, pruneHistory(messages.slice(1), maxHistoryTurns));
      return fullContent || "_(No response generated)_";
    }

    // Execute each requested tool
    for (const toolCall of toolCalls) {
      const { name, arguments: args } = toolCall.function;
      const argsDisplay = typeof args === "string" ? args : JSON.stringify(args);
      console.log(`[Agent] Tool call: ${name}(${argsDisplay})`);

      context.onToolCall?.(name, args);

      const tool = getToolByName(name);
      let result;

      if (!tool) {
        result = `Error: tool "${name}" is not registered.`;
      } else {
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
            result = await Promise.resolve(tool.execute(parsedArgs, { channelId, ...context }));
          } catch (err) {
            result = `Error executing tool "${name}": ${err.message}`;
          }
        }
      }

      console.log(`[Agent] Tool result for ${name}: ${result}`);
      context.onToolResult?.(name, result);

      messages.push({ role: "tool", content: String(result) });
    }
  }

  channelHistories.set(channelId, pruneHistory(messages.slice(1), maxHistoryTurns));
  return "_(Max tool rounds reached without a final response)_";
}
