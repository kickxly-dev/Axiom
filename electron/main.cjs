"use strict";

/**
 * electron/main.cjs
 *
 * Electron main process — creates the window, loads the ESM agent, and
 * exposes IPC channels that the renderer uses to drive conversations.
 *
 * The project uses "type":"module" (ESM), so the agent is loaded with
 * dynamic import() from this CJS file.
 */

const { app, BrowserWindow, ipcMain, shell, nativeTheme } = require("electron");
const path = require("path");
const fs   = require("fs");
const os   = require("os");

// Improve compatibility in virtualised / CI environments
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("disable-gpu-compositing");

// ── paths ────────────────────────────────────────────────────────────────────
const RENDERER_DIR   = path.join(__dirname, "renderer");
const SESSIONS_FILE  = path.join(app.getPath("userData"), "axiom-sessions.json");

// ── agent functions (populated after dynamic import) ─────────────────────────
let processMessageStream = null;
let clearHistoryFn       = null;

async function loadAgent() {
  // dotenv must be loaded before the agent reads env vars
  await import("dotenv/config");
  const mod = await import("../src/agent.js");
  processMessageStream = mod.processMessageStream;
  clearHistoryFn       = mod.clearHistory;
}

// ── window ───────────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  nativeTheme.themeSource = "dark";

  mainWindow = new BrowserWindow({
    width:           1120,
    height:          740,
    minWidth:        780,
    minHeight:       520,
    frame:           false,
    titleBarStyle:   "hidden",
    backgroundColor: "#0c0c0c",
    show:            false,
    webPreferences: {
      preload:          path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          true,
    },
  });

  mainWindow.loadFile(path.join(RENDERER_DIR, "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await loadAgent();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── window controls ──────────────────────────────────────────────────────────
ipcMain.on("window:minimize",  () => mainWindow?.minimize());
ipcMain.on("window:maximize",  () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on("window:close",     () => mainWindow?.close());

// ── session persistence ──────────────────────────────────────────────────────
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    }
  } catch (err) {
    console.error("[Main] Failed to load sessions:", err.message);
  }
  return [];
}

function saveSessions(sessions) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf8");
  } catch { /* ignore */ }
}

ipcMain.handle("sessions:list", () => loadSessions());

ipcMain.handle("sessions:save", (_event, sessions) => {
  saveSessions(sessions);
  return { ok: true };
});

// ── chat ─────────────────────────────────────────────────────────────────────
ipcMain.handle("chat:send", async (event, { sessionId, message }) => {
  if (!processMessageStream) return { ok: false, error: "Agent not loaded yet" };

  const sender = event.sender;

  const context = {
    onChunk(text) {
      if (!sender.isDestroyed()) {
        sender.send("chat:chunk", { sessionId, text });
      }
    },
    onToolCall(name, args) {
      if (!sender.isDestroyed()) {
        sender.send("chat:tool-call", { sessionId, name, args });
      }
    },
    onToolResult(name, result) {
      if (!sender.isDestroyed()) {
        sender.send("chat:tool-result", { sessionId, name, result });
      }
    },
  };

  try {
    const reply = await processMessageStream(sessionId, message, context);
    return { ok: true, reply };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("chat:clear", (_event, { sessionId }) => {
  clearHistoryFn?.(sessionId);
  return { ok: true };
});

// ── open external links safely ────────────────────────────────────────────────
ipcMain.on("shell:open-external", (_event, url) => {
  // Only allow http/https URLs
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
});
