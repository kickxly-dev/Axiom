'use strict';

/**
 * electron/main.cjs  — Axiom Desktop: Electron main process
 *
 * Responsibilities:
 *  - Load .env variables
 *  - Create the BrowserWindow
 *  - Handle IPC messages from the renderer (send-message, clear-history, etc.)
 *  - Lazily import the ESM agent (src/agent.js) via dynamic import()
 *  - Optionally start the Discord bot from within the app
 */

require('dotenv').config();

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// ─── State ────────────────────────────────────────────────────────────────────

let mainWindow = null;

// Lazily loaded from the ESM src/agent.js module
let processMessageFn = null;
let clearHistoryFn = null;

let discordBotRunning = false;

// Each desktop session gets its own conversation channel id
const DESKTOP_CHANNEL = 'desktop-app';

// ─── Agent loader ─────────────────────────────────────────────────────────────

async function loadAgent() {
  try {
    const agent = await import('../src/agent.js');
    processMessageFn = agent.processMessage;
    clearHistoryFn   = agent.clearHistory;
    console.log('[Desktop] Groq agent loaded.');
  } catch (err) {
    console.error('[Desktop] Failed to load agent module:', err.message);
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0f0f1a',
    show: false,           // revealed after 'ready-to-show'
    title: 'Axiom — AI Agent',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,       // needed so preload can use require()
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    pushStatusUpdate();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Status helper ────────────────────────────────────────────────────────────

function buildStatus() {
  return {
    groq:           !!process.env.GROQ_API_KEY,
    groqModel:      process.env.GROQ_MODEL || 'llama3-8b-8192',
    discord:        !!process.env.DISCORD_TOKEN,
    discordRunning: discordBotRunning,
    agentReady:     !!processMessageFn,
  };
}

function pushStatusUpdate() {
  mainWindow?.webContents.send('status-update', buildStatus());
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await loadAgent();
  createWindow();

  // macOS: re-create the window when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS it is convention to keep the app open until explicitly quit
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC handlers ─────────────────────────────────────────────────────────────

/** Send a message to the AI agent and return the response. */
ipcMain.handle('send-message', async (_event, userMessage) => {
  if (!processMessageFn) {
    return { error: 'Agent is not ready. Make sure GROQ_API_KEY is set in your .env file and restart the app.' };
  }
  if (!process.env.GROQ_API_KEY) {
    return { error: 'GROQ_API_KEY is not configured. Please set it in your .env file.' };
  }

  const context = {
    /** Deliver reminders back to the desktop chat window */
    sendCallback: async (reminderText) => {
      mainWindow?.webContents.send('ai-response', { content: reminderText, isReminder: true });
    },
    /** Stream tool-activity logs to the sidebar */
    onToolLog: (name, args, result) => {
      mainWindow?.webContents.send('tool-log', { name, args, result });
    },
  };

  try {
    const response = await processMessageFn(DESKTOP_CHANNEL, userMessage, context);
    return { content: response };
  } catch (err) {
    console.error('[Desktop] Agent error:', err);
    return { error: `Agent error: ${err.message}` };
  }
});

/** Clear the AI conversation history. */
ipcMain.handle('clear-history', () => {
  clearHistoryFn?.(DESKTOP_CHANNEL);
  return { success: true };
});

/** Return current connection status. */
ipcMain.handle('get-status', () => buildStatus());

/** Start the Discord bot (optional — runs alongside the chat window). */
ipcMain.handle('start-discord', async () => {
  if (!process.env.DISCORD_TOKEN) {
    return { error: 'DISCORD_TOKEN is not set in .env. Add it and restart the app.' };
  }
  if (discordBotRunning) {
    return { running: true, message: 'Discord bot is already running.' };
  }

  try {
    const { startBot } = await import('../src/bot.js');
    await startBot();
    discordBotRunning = true;
    pushStatusUpdate();
    return { running: true };
  } catch (err) {
    console.error('[Desktop] Discord bot error:', err);
    return { error: `Failed to start Discord bot: ${err.message}` };
  }
});

/** Open the .env file in the user's default text editor. */
ipcMain.handle('open-env-file', () => {
  const envPath = path.join(app.getAppPath(), '.env');
  shell.openPath(envPath);
  return { opened: true };
});
