/**
 * electron/renderer/app.js
 *
 * Drives the Axiom chat UI:
 *  - Session management (create / load / persist)
 *  - Message rendering with markdown + streaming
 *  - Tool-call / tool-result display
 *  - Composer input auto-grow + send
 */

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Minimal markdown → HTML (bold, italic, inline code, fenced code, lists) */
function renderMarkdown(text) {
  if (!text) return "";

  let html = text
    // escape HTML first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // fenced code blocks ``` ... ```
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    return `<pre><code class="lang-${lang}">${code.trimEnd()}</code></pre>`;
  });

  // inline code `...`
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // bold **...**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // italic *...*
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // unordered lists
  html = html.replace(/(^|\n)((?:[ \t]*[-*+] .+(?:\n|$))+)/g, (_m, pre, block) => {
    const items = block.trim().split("\n").map(l => `<li>${l.replace(/^[ \t]*[-*+] /, "")}</li>`).join("");
    return `${pre}<ul>${items}</ul>`;
  });

  // ordered lists
  html = html.replace(/(^|\n)((?:[ \t]*\d+\. .+(?:\n|$))+)/g, (_m, pre, block) => {
    const items = block.trim().split("\n").map(l => `<li>${l.replace(/^[ \t]*\d+\. /, "")}</li>`).join("");
    return `${pre}<ol>${items}</ol>`;
  });

  // newlines → <br> outside of block elements
  html = html.replace(/([^>])\n(?!<\/?(ul|ol|li|pre|code))/g, "$1<br>");

  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function shortTitle(text, max = 46) {
  const t = text.trim().replace(/\n+/g, " ");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function groupByDate(sessions) {
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  const now = new Date();
  for (const s of sessions) {
    const d = new Date(s.createdAt);
    const diff = Math.floor((now - d) / 86400000);
    if (diff < 1) groups.Today.push(s);
    else if (diff < 2) groups.Yesterday.push(s);
    else groups.Earlier.push(s);
  }
  return groups;
}

/* ── state ───────────────────────────────────────────────────────────────── */

let sessions     = [];    // [{id, title, createdAt, messages:[]}]
let activeId     = null;  // current session id
let isStreaming  = false;

function activeSession() {
  return sessions.find(s => s.id === activeId) ?? null;
}

/* ── DOM refs ────────────────────────────────────────────────────────────── */

const $welcome       = document.getElementById("welcome");
const $thread        = document.getElementById("thread");
const $input         = document.getElementById("input");
const $btnSend       = document.getElementById("btn-send");
const $sessionsList  = document.getElementById("sessions-list");
const $modelName     = document.getElementById("model-name");

/* ── session UI ──────────────────────────────────────────────────────────── */

function renderSidebar() {
  $sessionsList.innerHTML = "";
  const groups = groupByDate([...sessions].reverse());

  for (const [label, group] of Object.entries(groups)) {
    if (!group.length) continue;
    const heading = document.createElement("div");
    heading.className = "sessions-group-label";
    heading.textContent = label;
    $sessionsList.appendChild(heading);

    for (const s of group) {
      const btn = document.createElement("button");
      btn.className = "session-item" + (s.id === activeId ? " active" : "");
      btn.textContent = s.title || "New chat";
      btn.dataset.sid = s.id;
      btn.addEventListener("click", () => switchSession(s.id));
      $sessionsList.appendChild(btn);
    }
  }
}

function switchSession(id) {
  activeId = id;
  renderSidebar();
  renderThread();
}

function newSession() {
  const s = {
    id:        genId(),
    title:     "New chat",
    createdAt: new Date().toISOString(),
    messages:  [],
  };
  sessions.push(s);
  activeId = s.id;
  renderSidebar();
  renderThread();
  $input.focus();
}

async function persistSessions() {
  await window.axiom.saveSessions(sessions);
}

/* ── thread rendering ────────────────────────────────────────────────────── */

function renderThread() {
  const session = activeSession();

  if (!session || session.messages.length === 0) {
    $welcome.hidden = false;
    $thread.hidden  = true;
    return;
  }

  $welcome.hidden = true;
  $thread.hidden  = false;
  $thread.innerHTML = "";

  for (const msg of session.messages) {
    appendMessageDOM(msg, false);
  }
  scrollBottom();
}

/**
 * Append a rendered message row to the thread.
 * @param {object} msg  - {role, content, toolCalls?, isError?}
 * @param {boolean} animate
 * @returns {HTMLElement} the .msg-row element
 */
function appendMessageDOM(msg, animate = true) {
  const isUser = msg.role === "user";
  const row = document.createElement("div");
  row.className = "msg-row" + (msg.isError ? " msg-error" : "");
  if (!animate) row.style.animation = "none";

  // avatar
  const av = document.createElement("div");
  av.className = isUser ? "msg-avatar user-av" : "msg-avatar ai-av";
  av.textContent = isUser ? "Y" : "A";

  // body
  const body = document.createElement("div");
  body.className = "msg-body";

  const name = document.createElement("div");
  name.className = isUser ? "msg-name user-name" : "msg-name";
  name.textContent = isUser ? "You" : "Axiom";

  const content = document.createElement("div");
  content.className = "msg-content";

  if (isUser) {
    content.textContent = msg.content;
  } else {
    content.innerHTML = renderMarkdown(msg.content ?? "");
  }

  body.appendChild(name);

  // tool calls / results
  if (msg.toolCalls?.length) {
    for (const tc of msg.toolCalls) {
      body.appendChild(buildToolPill(tc, true));
    }
  }

  body.appendChild(content);
  row.appendChild(av);
  row.appendChild(body);
  $thread.appendChild(row);
  return row;
}

/**
 * Build a tool-call pill (collapsed, expandable).
 */
function buildToolPill(tc, done) {
  const wrap = document.createElement("div");
  wrap.className = "tool-result-wrap";

  const pill = document.createElement("div");
  pill.className = "tool-pill";

  if (done) {
    pill.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      ${escapeHtml(tc.name)}(${escapeHtml(JSON.stringify(tc.args ?? {}).slice(1, -1).slice(0, 60))})
    `;
  } else {
    pill.innerHTML = `
      <span class="tool-spinner"></span>
      ${escapeHtml(tc.name)}…
    `;
  }

  const resultPre = document.createElement("pre");
  resultPre.className = "tool-result-pre";
  resultPre.textContent = tc.result ? JSON.stringify(tc.result, null, 2) : "";

  pill.addEventListener("click", () => {
    if (resultPre.textContent) wrap.classList.toggle("expanded");
  });

  wrap.appendChild(pill);
  wrap.appendChild(resultPre);
  return wrap;
}

function addThinkingRow() {
  const row = document.createElement("div");
  row.id = "thinking-row";
  row.className = "msg-row";

  const av = document.createElement("div");
  av.className = "msg-avatar ai-av";
  av.textContent = "A";

  const body = document.createElement("div");
  body.className = "msg-body";

  const name = document.createElement("div");
  name.className = "msg-name";
  name.textContent = "Axiom";

  const dots = document.createElement("div");
  dots.className = "msg-content thinking-dots";
  dots.innerHTML = "<span></span><span></span><span></span>";

  body.appendChild(name);
  body.appendChild(dots);
  row.appendChild(av);
  row.appendChild(body);
  $thread.appendChild(row);
  scrollBottom();
  return row;
}

function scrollBottom() {
  requestAnimationFrame(() => {
    $thread.scrollTop = $thread.scrollHeight;
  });
}

/* ── streaming state ─────────────────────────────────────────────────────── */

let streamRow        = null;   // .msg-row currently being streamed into
let streamContent    = null;   // .msg-content div in streamRow
let streamText       = "";     // accumulated text
let activeToolCalls  = {};     // name → pill wrap (pending tool calls in current response)

function startStreamRow() {
  // Remove thinking dots
  document.getElementById("thinking-row")?.remove();

  const row = document.createElement("div");
  row.className = "msg-row";
  const av = document.createElement("div");
  av.className = "msg-avatar ai-av";
  av.textContent = "A";

  const body = document.createElement("div");
  body.className = "msg-body";

  const name = document.createElement("div");
  name.className = "msg-name";
  name.textContent = "Axiom";

  const content = document.createElement("div");
  content.className = "msg-content streaming-cursor";

  body.appendChild(name);
  body.appendChild(content);
  row.appendChild(av);
  row.appendChild(body);
  $thread.appendChild(row);

  streamRow     = row;
  streamContent = content;
  streamText    = "";
  activeToolCalls = {};
  scrollBottom();
}

function appendStreamChunk(text) {
  if (!streamContent) startStreamRow();
  streamText += text;
  streamContent.innerHTML = renderMarkdown(streamText);
  scrollBottom();
}

function showToolCallPending(name, args) {
  if (!streamRow) startStreamRow();

  const body = streamRow.querySelector(".msg-body");
  const tc   = { name, args };
  const wrap = buildToolPill(tc, false);
  wrap.dataset.toolName = name;

  // Insert before content
  body.insertBefore(wrap, streamContent);
  activeToolCalls[name] = wrap;
  scrollBottom();
}

function resolveToolCall(name, result) {
  const wrap = activeToolCalls[name];
  if (!wrap) return;

  // Replace spinner pill with completed pill
  const pill = wrap.querySelector(".tool-pill");
  pill.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    ${escapeHtml(name)}
  `;

  const pre = wrap.querySelector(".tool-result-pre");
  pre.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);

  pill.addEventListener("click", () => {
    if (pre.textContent) wrap.classList.toggle("expanded");
  });
}

function finalizeStream(fullContent, toolCallsList) {
  if (streamContent) {
    streamContent.classList.remove("streaming-cursor");
    streamContent.innerHTML = renderMarkdown(fullContent || streamText);
  }
  // Save to session
  const session = activeSession();
  if (session) {
    session.messages.push({
      role:      "assistant",
      content:   fullContent || streamText,
      toolCalls: toolCallsList?.length ? toolCallsList : undefined,
    });
    persistSessions();
  }
  streamRow = null;
  streamContent = null;
  streamText = "";
  activeToolCalls = {};
}

/* ── send message ────────────────────────────────────────────────────────── */

async function sendMessage() {
  const text = $input.value.trim();
  if (!text || isStreaming) return;

  // Ensure we have an active session
  if (!activeId) newSession();

  const session = activeSession();
  if (!session) return;

  // Auto-title the session from the first user message
  if (session.messages.length === 0 && session.title === "New chat") {
    session.title = shortTitle(text);
    renderSidebar();
  }

  // Append user message
  session.messages.push({ role: "user", content: text });
  persistSessions();

  // Reset input
  $input.value = "";
  $input.style.height = "auto";
  updateSendBtn();

  // Show thread
  $welcome.hidden = true;
  $thread.hidden  = false;
  appendMessageDOM({ role: "user", content: text });
  addThinkingRow();
  scrollBottom();

  isStreaming = true;
  updateSendBtn();

  const pendingToolCalls = [];

  // Register streaming listeners
  const removeChunk = window.axiom.onChunk(({ sessionId, text: chunk }) => {
    if (sessionId !== activeId) return;
    appendStreamChunk(chunk);
  });

  const removeTool = window.axiom.onToolCall(({ sessionId, name, args }) => {
    if (sessionId !== activeId) return;
    pendingToolCalls.push({ name, args });
    showToolCallPending(name, args);
  });

  const removeResult = window.axiom.onToolResult(({ sessionId, name, result }) => {
    if (sessionId !== activeId) return;
    const tc = pendingToolCalls.find(t => t.name === name && !t.result);
    if (tc) tc.result = result;
    resolveToolCall(name, result);
  });

  try {
    const res = await window.axiom.send(activeId, text);

    // Remove listeners
    removeChunk();
    removeTool();
    removeResult();

    if (!res.ok) {
      // error
      document.getElementById("thinking-row")?.remove();
      if (streamRow) {
        streamRow.classList.add("msg-error");
        streamContent.textContent = `Error: ${res.error}`;
        streamContent.classList.remove("streaming-cursor");
        streamRow = null; streamContent = null;
      } else {
        appendMessageDOM({ role: "assistant", content: `Error: ${res.error}`, isError: true });
      }
    } else {
      finalizeStream(res.reply, pendingToolCalls);
    }
  } catch (err) {
    removeChunk(); removeTool(); removeResult();
    document.getElementById("thinking-row")?.remove();
    appendMessageDOM({ role: "assistant", content: `Error: ${err.message}`, isError: true });
  }

  isStreaming = false;
  updateSendBtn();
  $input.focus();
}

/* ── input auto-grow ─────────────────────────────────────────────────────── */

function updateSendBtn() {
  $btnSend.disabled = isStreaming || !$input.value.trim();
}

$input.addEventListener("input", () => {
  $input.style.height = "auto";
  $input.style.height = Math.min($input.scrollHeight, 160) + "px";
  updateSendBtn();
});

$input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

$btnSend.addEventListener("click", sendMessage);

/* ── welcome chips ───────────────────────────────────────────────────────── */

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    $input.value = chip.dataset.prompt;
    updateSendBtn();
    sendMessage();
  });
});

/* ── new chat ────────────────────────────────────────────────────────────── */

document.getElementById("btn-new-chat").addEventListener("click", newSession);

/* ── window controls ─────────────────────────────────────────────────────── */

document.getElementById("btn-minimize").addEventListener("click", () => window.axiom.minimize());
document.getElementById("btn-maximize").addEventListener("click", () => window.axiom.maximize());
document.getElementById("btn-close").addEventListener("click",    () => window.axiom.close());

/* ── init ────────────────────────────────────────────────────────────────── */

(async function init() {
  // Load persisted sessions
  sessions = (await window.axiom.listSessions()) ?? [];

  // Show model name from env if available
  // (passed via a data attribute on the model-name element set in main.cjs, or default)
  // For now we keep the default from HTML; main can update via IPC if needed.

  if (sessions.length === 0) {
    newSession();
  } else {
    activeId = sessions[sessions.length - 1].id;
    renderSidebar();
    renderThread();
  }

  $input.focus();
})();
