/**
 * web/client.js
 *
 * Minimal web client for the Axiom API.
 * Served alongside web/index.html via any static file server or the API's
 * static middleware.
 *
 * Reads API_BASE_URL from the <meta name="axiom-api-url"> tag or defaults
 * to http://localhost:3000.
 */

const API_BASE = (() => {
  const meta = document.querySelector('meta[name="axiom-api-url"]');
  return (meta?.content || "http://localhost:3000").replace(/\/$/, "");
})();

// ── State ─────────────────────────────────────────────────────────────────────
let channelId = `web-${Date.now()}`;
let busy      = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const messagesEl    = document.getElementById("messages");
const inputEl       = document.getElementById("user-input");
const sendBtn       = document.getElementById("send-btn");
const statusEl      = document.getElementById("status");
const personaSel    = document.getElementById("persona-select");
const userIdInput   = document.getElementById("user-id-input");

// ── Health check ──────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const r = await fetch(`${API_BASE}/health`);
    if (r.ok) {
      setStatus("API connected ✓", "ok");
    } else {
      setStatus(`API returned ${r.status}`, "error");
    }
  } catch {
    setStatus("Cannot reach API — is it running? (npm run start:api)", "error");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setStatus(text, cls = "") {
  statusEl.textContent  = text;
  statusEl.className    = cls;
}

function setBusy(val) {
  busy          = val;
  sendBtn.disabled = val;
  inputEl.disabled = val;
}

/**
 * Very basic markdown-like formatter:
 * - ``` fenced code blocks
 * - `inline code`
 * - **bold**
 * - newlines → <br>
 */
function formatText(text) {
  // Escape HTML first
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Fenced code blocks
  let result = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Newlines outside of pre blocks — replace \n with <br> in non-pre segments
  result = result.split(/<pre>[\s\S]*?<\/pre>/g).map((seg) =>
    seg.replace(/\n/g, "<br>")
  ).join(result.match(/<pre>[\s\S]*?<\/pre>/g)?.join("") || "");

  // Simpler approach: replace all \n → <br> (pre blocks are already rendered)
  result = escaped
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!<\/pre>)\n/g, "<br>");

  return result;
}

function appendMessage(role, html, cssClass = "") {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role}`;

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = role === "user" ? "You" : "Axiom";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${cssClass}`;
  bubble.innerHTML = html;

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendMessage() {
  const message = inputEl.value.trim();
  if (!message || busy) return;

  inputEl.value = "";
  inputEl.style.height = "";

  appendMessage("user", formatText(message));

  // Thinking indicator
  const thinkingBubble = appendMessage("axiom", "…", "thinking");

  setBusy(true);
  setStatus("Sending…");

  const userId = userIdInput.value.trim() || undefined;

  // If userId given, sync persona
  if (userId) {
    const persona = personaSel.value;
    try {
      await fetch(`${API_BASE}/memory/${encodeURIComponent(userId)}/persona`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ persona }),
      });
    } catch { /* non-fatal */ }
  }

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ channelId, message, userId }),
    });

    const data = await res.json();
    thinkingBubble.parentElement.remove();

    if (!res.ok || data.error) {
      appendMessage("axiom", `❌ Error: ${data.error || res.statusText}`, "error");
      setStatus("Error", "error");
    } else {
      appendMessage("axiom", formatText(data.reply));
      setStatus("API connected ✓", "ok");
    }
  } catch (err) {
    thinkingBubble.parentElement.remove();
    appendMessage("axiom", `❌ Network error: ${err.message}`, "error");
    setStatus("Network error", "error");
  }

  setBusy(false);
  inputEl.focus();
}

// ── Event listeners ───────────────────────────────────────────────────────────
sendBtn.addEventListener("click", sendMessage);

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
});

// ── Init ──────────────────────────────────────────────────────────────────────
checkHealth();
inputEl.focus();
