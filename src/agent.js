/**
 * agent.js
 *
 * Core AI agent loop — primary provider is OpenRouter (OpenAI-compatible Chat
 * Completions API). Falls back to Google AI Studio (Gemini) when
 * OPENROUTER_API_KEY is not set.
 *
 *   1. Sends user messages to the configured LLM provider.
 *   2. Handles function-call responses by executing the matching tool.
 *   3. Feeds tool results back until a final text response is produced.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getToolDefinitions, getToolByName } from "./tools/index.js";
import { clearChannelNotes } from "./tools/notes.js";

// ── Shared config ─────────────────────────────────────────────────────────────

let googleApiKey      = null;
let googleModel       = null;
let openrouterApiKey  = null;
let openrouterModel   = null;
let openrouterBaseUrl = null;
let systemPrompt      = null;
let maxToolRounds     = null;
let maxHistoryTurns   = null;
let verbosity         = null;

/**
 * Read provider config from environment (lazily, so dotenv is loaded first).
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
    googleApiKey      = process.env.GOOGLE_AI_API_KEY    || "";
    googleModel       = process.env.GOOGLE_AI_MODEL      || "gemini-2.0-flash";
    openrouterApiKey  = process.env.OPENROUTER_API_KEY   || "";
    openrouterModel   = process.env.OPENROUTER_MODEL     || "google/gemini-2.0-flash-exp:free";
    openrouterBaseUrl = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    verbosity         = (process.env.RESPONSE_VERBOSITY  || "concise").toLowerCase();
    if (!VERBOSITY_INSTRUCTIONS[verbosity]) {
      console.warn(
        `[Agent] Unknown RESPONSE_VERBOSITY "${verbosity}" — falling back to "concise".`
      );
      verbosity = "concise";
    }
    const basePrompt = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
    systemPrompt    = `${basePrompt}\n\nTone & length: ${VERBOSITY_INSTRUCTIONS[verbosity]}`;
    maxToolRounds   = parseInt(process.env.MAX_TOOL_ROUNDS   || "5",  10);
    maxHistoryTurns = parseInt(process.env.MAX_HISTORY_TURNS || "20", 10);

    if (openrouterApiKey) {
      console.log(`[Agent] Provider: OpenRouter (model: ${openrouterModel})`);
    } else if (googleApiKey) {
      console.log(`[Agent] Provider: Google AI Studio (model: ${googleModel})`);
    } else {
      console.warn(
        "[Agent] Neither OPENROUTER_API_KEY nor GOOGLE_AI_API_KEY is set — requests will fail."
      );
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
 * Build a Gemini SDK model instance for a single request.
 *
 * @param {string|null} systemInstruction
 * @param {Array<object>} functionDeclarations
 * @returns {import("@google/generative-ai").GenerativeModel}
 */
function buildGeminiModel(systemInstruction, functionDeclarations) {
  const genAI = new GoogleGenerativeAI(googleApiKey);
  return genAI.getGenerativeModel({
    model: googleModel,
    ...(systemInstruction ? { systemInstruction } : {}),
    ...(functionDeclarations.length > 0
      ? { tools: [{ functionDeclarations }] }
      : {}),
  });
}

/**
 * Convert tool definitions to Gemini functionDeclarations format.
 *
 * @param {Array<object>} tools  Tool definitions from getToolDefinitions()
 * @returns {Array<object>}
 */
function toFunctionDeclarations(tools) {
  return tools
    .filter((t) => t.type === "function")
    .map((t) => ({
      name:        t.function.name,
      description: t.function.description,
      parameters:  t.function.parameters,
    }));
}

/**
 * Rethrow a Google AI SDK error with a human-readable message.
 *
 * @param {unknown} err
 * @returns {never}
 */
function rethrowGeminiError(err) {
  const status = err.status ?? err.statusCode;
  if (status === 400) {
    throw new Error(`Google AI Studio HTTP 400 (Bad request — check your GOOGLE_AI_MODEL name): ${err.message}`);
  } else if (status === 403) {
    throw new Error(`Google AI Studio HTTP 403 (Forbidden — check that GOOGLE_AI_API_KEY is valid): ${err.message}`);
  } else if (status === 404) {
    throw new Error(`Google AI Studio HTTP 404 (Model not found — check your GOOGLE_AI_MODEL name): ${err.message}`);
  } else if (status === 429) {
    throw new Error(`Google AI Studio HTTP 429 (Rate limited — too many requests): ${err.message}`);
  } else if (status === 500 || status === 503) {
    throw new Error(`Google AI Studio HTTP ${status} (Server error — please try again): ${err.message}`);
  }
  throw new Error(`Cannot reach Google AI Studio: ${err.message}`);
}

/**
 * Send a single chat request to Google AI Studio and return the response.
 *
 * @param {Array<object>} messages
 * @param {Array<object>} tools
 * @returns {Promise<{ role: "assistant", content: string, tool_calls?: Array }>}
 */
async function geminiChat(messages, tools) {
  const { systemInstruction, contents } = toGeminiContents(messages);
  const model = buildGeminiModel(systemInstruction, toFunctionDeclarations(tools));

  let response;
  try {
    const result = await model.generateContent({ contents });
    response = result.response;
  } catch (err) {
    rethrowGeminiError(err);
  }

  return parseGeminiResponse({
    candidates:     response.candidates,
    promptFeedback: response.promptFeedback,
  });
}

// ── OpenRouter (primary provider) ────────────────────────────────────────────

/**
 * Rethrow an OpenRouter HTTP error with a human-readable message.
 *
 * @param {number} status
 * @param {object} data  Parsed JSON body (may be empty)
 * @returns {never}
 */
function rethrowOpenRouterError(status, data) {
  const msg = data?.error?.message || data?.message || "Unknown error";
  if (status === 401) {
    throw new Error(`OpenRouter HTTP 401 (Unauthorized — check your OPENROUTER_API_KEY): ${msg}`);
  } else if (status === 403) {
    throw new Error(`OpenRouter HTTP 403 (Forbidden — your key lacks access to this model): ${msg}`);
  } else if (status === 404) {
    throw new Error(`OpenRouter HTTP 404 (Model not found — check your OPENROUTER_MODEL name): ${msg}`);
  } else if (status === 429) {
    throw new Error(`OpenRouter HTTP 429 (Rate limited — too many requests): ${msg}`);
  } else if (status >= 500) {
    throw new Error(`OpenRouter HTTP ${status} (Server error — please try again): ${msg}`);
  }
  throw new Error(`OpenRouter error ${status}: ${msg}`);
}

/**
 * Convert the internal OpenAI-style message array into a format suitable for
 * the OpenRouter Chat Completions API.
 *
 * The internal history stores tool_calls without `id`/`type` and tool messages
 * without `tool_call_id`.  This function assigns sequential IDs so OpenRouter
 * can match each tool result back to the originating call.
 *
 * @param {Array<object>} messages
 * @returns {Array<object>}
 */
function toOpenRouterMessages(messages) {
  const out = [];
  let callCounter = 0;

  for (let i = 0; i < messages.length; ) {
    const msg = messages[i];

    if (msg.role === "system") {
      out.push({ role: "system", content: msg.content || "" });
      i++;
    } else if (msg.role === "user") {
      out.push({ role: "user", content: msg.content || "" });
      i++;
    } else if (msg.role === "assistant") {
      if (msg.tool_calls?.length) {
        // Assign sequential IDs to each tool call
        const callsWithIds = msg.tool_calls.map((tc, idx) => ({
          id:   `call_${callCounter + idx}`,
          type: "function",
          function: {
            name:      tc.function.name,
            arguments: typeof tc.function.arguments === "string"
              ? tc.function.arguments
              : JSON.stringify(tc.function.arguments || {}),
          },
        }));
        out.push({ role: "assistant", content: msg.content || null, tool_calls: callsWithIds });
        i++;

        // Collect the immediately-following tool-result messages
        let tcIdx = 0;
        while (i < messages.length && messages[i].role === "tool") {
          out.push({
            role:         "tool",
            tool_call_id: `call_${callCounter + tcIdx}`,
            content:      messages[i].content || "",
          });
          tcIdx++;
          i++;
        }
        callCounter += callsWithIds.length;
      } else {
        out.push({ role: "assistant", content: msg.content || "" });
        i++;
      }
    } else {
      i++; // skip orphaned roles
    }
  }

  return out;
}

/**
 * Send a single chat request to OpenRouter and return the response.
 *
 * @param {Array<object>} messages  Internal OpenAI-style messages
 * @param {Array<object>} tools     Tool definitions (OpenAI format)
 * @returns {Promise<{ role: "assistant", content: string, tool_calls?: Array }>}
 */
async function openrouterChat(messages, tools) {
  const body = {
    model:    openrouterModel,
    messages: toOpenRouterMessages(messages),
    ...(tools.length > 0 ? { tools } : {}),
  };

  let res;
  try {
    res = await fetch(`${openrouterBaseUrl}/chat/completions`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${openrouterApiKey}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://github.com/kickxly-dev/Axiom",
        "X-Title":       "Axiom",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Cannot reach OpenRouter: ${err.message}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`OpenRouter returned a non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok) {
    rethrowOpenRouterError(res.status, data);
  }

  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error("No choices in OpenRouter response");
  }

  const msg       = choice.message;
  const content   = msg.content || "";
  const toolCalls = (msg.tool_calls || []).map((tc) => ({
    function: {
      name:      tc.function.name,
      arguments: tc.function.arguments || "{}",
    },
  }));

  return {
    role: "assistant",
    content,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
}

/**
 * Async generator that streams response chunks from OpenRouter via SSE.
 * Each yielded value is a normalised chunk: { content?: string, tool_calls?: Array }
 *
 * Tool-call arguments are accumulated across chunks and emitted as a single
 * tool_calls entry when the stream finishes or the finish_reason is "tool_calls".
 *
 * @param {Array<object>} messages  Internal OpenAI-style messages
 * @param {Array<object>} tools     Tool definitions (OpenAI format)
 * @yields {{ content: string, tool_calls?: Array }}
 */
async function* openrouterChatStream(messages, tools) {
  const body = {
    model:    openrouterModel,
    messages: toOpenRouterMessages(messages),
    ...(tools.length > 0 ? { tools } : {}),
    stream: true,
  };

  let res;
  try {
    res = await fetch(`${openrouterBaseUrl}/chat/completions`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${openrouterApiKey}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://github.com/kickxly-dev/Axiom",
        "X-Title":       "Axiom",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Cannot reach OpenRouter: ${err.message}`);
  }

  if (!res.ok) {
    let errData;
    try { errData = await res.json(); } catch { errData = {}; }
    rethrowOpenRouterError(res.status, errData);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";
  // Accumulate tool-call argument strings keyed by their stream index
  const pendingCalls = {};

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        const calls = Object.values(pendingCalls);
        if (calls.length > 0) yield { content: "", tool_calls: calls };
        return;
      }

      let event;
      try { event = JSON.parse(payload); } catch { continue; }

      const choice = event.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta || {};

      if (delta.content) {
        yield { content: delta.content };
      }

      if (delta.tool_calls?.length) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!pendingCalls[idx]) {
            pendingCalls[idx] = { function: { name: "", arguments: "" } };
          }
          if (tc.function?.name)      pendingCalls[idx].function.name      += tc.function.name;
          if (tc.function?.arguments) pendingCalls[idx].function.arguments += tc.function.arguments;
        }
      }

      if (choice.finish_reason === "tool_calls") {
        const calls = Object.values(pendingCalls);
        if (calls.length > 0) yield { content: "", tool_calls: calls };
        return;
      }

      if (
        choice.finish_reason &&
        choice.finish_reason !== "stop" &&
        choice.finish_reason !== "tool_calls" &&
        choice.finish_reason !== "length"
      ) {
        console.warn(`[Agent] OpenRouter stream ended with finish_reason="${choice.finish_reason}"`);
        break outer;
      }
    }
  }

  // Flush any accumulated tool calls at EOF (no explicit [DONE] received)
  const calls = Object.values(pendingCalls);
  if (calls.length > 0) yield { content: "", tool_calls: calls };
}

// ── Provider selector ─────────────────────────────────────────────────────────

/**
 * Send a single chat request using the configured provider (OpenRouter when
 * OPENROUTER_API_KEY is set, Google AI Studio otherwise).
 *
 * @param {Array<object>} messages
 * @param {Array<object>} tools
 * @returns {Promise<{ role: "assistant", content: string, tool_calls?: Array }>}
 */
async function llmChat(messages, tools) {
  if (openrouterApiKey) {
    return openrouterChat(messages, tools);
  }
  return geminiChat(messages, tools);
}

/**
 * Async generator for streaming chat using the configured provider.
 *
 * @param {Array<object>} messages
 * @param {Array<object>} tools
 * @yields {{ content: string, tool_calls?: Array }}
 */
async function* llmChatStream(messages, tools) {
  if (openrouterApiKey) {
    yield* openrouterChatStream(messages, tools);
    return;
  }
  yield* geminiChatStream(messages, tools);
}



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
 * Process a user message through the agent loop.
 *
 * Uses OpenRouter when OPENROUTER_API_KEY is set; falls back to Google AI
 * Studio (Gemini) otherwise.
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
    const assistantMessage = await llmChat(messages, toolDefs);

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
 * Async generator that streams response chunks from Google AI Studio.
 * Each yielded value is a normalised chunk: { content?: string, tool_calls?: Array }
 *
 * @param {Array<object>} messages
 * @param {Array<object>} tools
 * @yields {{ content: string, tool_calls?: Array }}
 */
async function* geminiChatStream(messages, tools) {
  const { systemInstruction, contents } = toGeminiContents(messages);
  const model = buildGeminiModel(systemInstruction, toFunctionDeclarations(tools));

  let streamResult;
  try {
    streamResult = await model.generateContentStream({ contents });
  } catch (err) {
    rethrowGeminiError(err);
  }

  for await (const chunk of streamResult.stream) {
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
  }
}

/**
 * Process a user message through the agent loop, streaming response tokens
 * back to the caller via context callbacks.
 *
 * Uses OpenRouter when OPENROUTER_API_KEY is set; falls back to Google AI
 * Studio (Gemini) otherwise.
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
    for await (const chunk of llmChatStream(messages, toolDefs)) {
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
