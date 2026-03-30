/**
 * electron/renderer/app.js  — Axiom Desktop: renderer-side logic
 *
 * Communicates with the main process via the `window.axiom` API
 * exposed by preload.cjs through contextBridge.
 */

/* ─── DOM refs ──────────────────────────────────────────────────────────────── */

const messagesEl      = document.getElementById('messages');
const inputEl         = document.getElementById('message-input');
const sendBtn         = document.getElementById('send-btn');
const clearBtn        = document.getElementById('clear-btn');
const startDiscordBtn = document.getElementById('start-discord-btn');
const openEnvBtn      = document.getElementById('open-env-btn');
const thinkingBar     = document.getElementById('thinking-bar');
const welcomeEl       = document.getElementById('welcome');
const toolLogList     = document.getElementById('tool-log-list');
const agentBadge      = document.getElementById('agent-status-badge');
const groqDot         = document.getElementById('groq-dot');
const groqDetail      = document.getElementById('groq-detail');
const discordDot      = document.getElementById('discord-dot');
const discordDetail   = document.getElementById('discord-detail');
const modelBadge      = document.getElementById('model-badge');

/* ─── State ─────────────────────────────────────────────────────────────────── */

let isBusy = false;

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Very lightweight Markdown → HTML (bold, code, newlines only).
 * Keeps the renderer free of 3rd-party dependencies.
 */
function markdownToHtml(text) {
  return text
    // Fenced code blocks  ```...```
    .replace(/```[\s\S]*?```/g, (m) => {
      const inner = m.slice(3, -3).replace(/^[a-z]+\n/, '');
      return `<pre><code>${escHtml(inner)}</code></pre>`;
    })
    // Inline code `...`
    .replace(/`([^`\n]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    // Bold **...**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *...*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Newlines → <br>
    .replace(/\n/g, '<br>');
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Append a message bubble to the chat. */
function appendMessage(role, text, options = {}) {
  // Hide the welcome screen on first real message
  if (welcomeEl) welcomeEl.style.display = 'none';

  const msg = document.createElement('div');
  msg.className = `msg ${role}${options.isReminder ? ' reminder' : ''}${options.isError ? ' error' : ''}`;

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = role === 'user' ? 'You' : options.isReminder ? '⏰ Reminder' : 'Axiom';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if (role === 'ai' && !options.isError) {
    bubble.innerHTML = markdownToHtml(text);
  } else {
    bubble.textContent = text;
  }

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = formatTime(new Date());

  msg.appendChild(label);
  msg.appendChild(bubble);
  msg.appendChild(time);
  messagesEl.appendChild(msg);

  // Auto-scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return msg;
}

/** Add a tool-activity entry to the sidebar log. */
function appendToolLog(name, args, result) {
  // Remove the empty hint if it's still there
  const hint = toolLogList.querySelector('.empty-hint');
  if (hint) hint.remove();

  const entry = document.createElement('div');
  entry.className = 'tool-entry';

  const nameEl = document.createElement('div');
  nameEl.className = 'tool-name';
  nameEl.textContent = `⚙ ${name}`;

  const argsEl = document.createElement('div');
  argsEl.className = 'tool-args';
  const argsStr = typeof args === 'object' ? JSON.stringify(args) : String(args);
  argsEl.textContent = `↳ ${argsStr.length > 80 ? argsStr.slice(0, 80) + '…' : argsStr}`;

  const resultEl = document.createElement('div');
  resultEl.className = 'tool-result';
  const resStr = String(result);
  resultEl.textContent = `= ${resStr.length > 80 ? resStr.slice(0, 80) + '…' : resStr}`;

  entry.appendChild(nameEl);
  entry.appendChild(argsEl);
  entry.appendChild(resultEl);

  // Prepend so latest is at top
  toolLogList.insertBefore(entry, toolLogList.firstChild);
}

/** Update the connection-status UI. */
function applyStatus(status) {
  // Groq dot
  if (status.groq) {
    groqDot.className = 'dot green';
    groqDetail.textContent = 'Connected';
  } else {
    groqDot.className = 'dot red';
    groqDetail.textContent = 'API key not set';
  }

  // Discord dot
  if (status.discordRunning) {
    discordDot.className = 'dot green';
    discordDetail.textContent = 'Bot online';
    startDiscordBtn.textContent = '🤖 Discord Running';
    startDiscordBtn.disabled = true;
  } else if (status.discord) {
    discordDot.className = 'dot orange';
    discordDetail.textContent = 'Token set, not started';
  } else {
    discordDot.className = 'dot red';
    discordDetail.textContent = 'Token not set';
  }

  // Model badge — show "Provider · model"
  if (status.groqModel) {
    const provider = status.groqProvider || 'Groq';
    modelBadge.textContent = `${provider} · ${status.groqModel}`;
    modelBadge.title = status.groqProviderUrl || 'https://console.groq.com';
  }

  // Agent-ready badge in header
  if (status.agentReady && status.groq) {
    agentBadge.textContent = '● Ready';
    agentBadge.className = 'agent-status ready';
    sendBtn.disabled = false;
  } else {
    agentBadge.textContent = '● Not configured';
    agentBadge.className = 'agent-status error';
  }
}

/** Lock / unlock the input during processing. */
function setBusy(busy) {
  isBusy = busy;
  sendBtn.disabled = busy;
  inputEl.disabled = busy;
  thinkingBar.hidden = !busy;
  if (busy) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

/* ─── Send a message ────────────────────────────────────────────────────────── */

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isBusy) return;

  inputEl.value = '';
  autoResize();

  appendMessage('user', text);
  setBusy(true);

  try {
    const result = await window.axiom.sendMessage(text);
    if (result.error) {
      appendMessage('ai', result.error, { isError: true });
    } else {
      appendMessage('ai', result.content || '_(No response)_');
    }
  } catch (err) {
    appendMessage('ai', `Unexpected error: ${err.message}`, { isError: true });
  } finally {
    setBusy(false);
    inputEl.focus();
  }
}

/* ─── Auto-resize textarea ──────────────────────────────────────────────────── */

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
}

/* ─── Event listeners ───────────────────────────────────────────────────────── */

inputEl.addEventListener('input', () => {
  autoResize();
  // Only enable send button if there's text AND agent is ready
  agentBadge.classList.contains('ready')
    ? (sendBtn.disabled = !inputEl.value.trim() || isBusy)
    : (sendBtn.disabled = true);
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

clearBtn.addEventListener('click', async () => {
  await window.axiom.clearHistory();
  // Remove all message bubbles but keep the welcome screen
  messagesEl.innerHTML = '';
  if (welcomeEl) {
    welcomeEl.style.display = '';
    messagesEl.appendChild(welcomeEl);
  }
  // Clear tool log sidebar
  toolLogList.innerHTML = '<p class="empty-hint">No tool calls yet</p>';
});

startDiscordBtn.addEventListener('click', async () => {
  startDiscordBtn.disabled = true;
  startDiscordBtn.textContent = '⏳ Starting…';

  const result = await window.axiom.startDiscord();
  if (result.error) {
    startDiscordBtn.disabled = false;
    startDiscordBtn.textContent = '🤖 Start Discord Bot';
    appendMessage('ai', `Could not start Discord bot: ${result.error}`, { isError: true });
  } else {
    startDiscordBtn.textContent = '🤖 Discord Running';
    discordDot.className = 'dot green';
    discordDetail.textContent = 'Bot online';
  }
});

openEnvBtn.addEventListener('click', () => window.axiom.openEnvFile());

// Example-prompt buttons
document.querySelectorAll('.example-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    inputEl.value = btn.dataset.text;
    autoResize();
    sendBtn.disabled = false;
    inputEl.focus();
  });
});

/* ─── IPC push events ───────────────────────────────────────────────────────── */

// Reminders and other async AI pushes
window.axiom.onAiResponse((data) => {
  appendMessage('ai', data.content, { isReminder: data.isReminder });
});

// Tool activity → sidebar log
window.axiom.onToolLog((data) => {
  appendToolLog(data.name, data.args, data.result);
});

// Status updates from main process
window.axiom.onStatusUpdate((status) => {
  applyStatus(status);
});

/* ─── Initialise ────────────────────────────────────────────────────────────── */

(async () => {
  const status = await window.axiom.getStatus();
  applyStatus(status);
  inputEl.focus();
})();
