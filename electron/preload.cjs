'use strict';

/**
 * electron/preload.cjs  — Contextbridge preload script
 *
 * Runs in a privileged renderer context and exposes a safe, narrow API
 * to the renderer page via contextBridge.  No Node/Electron APIs are
 * exposed directly to untrusted renderer code.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('axiom', {

  // ── Requests (invoke → Promise) ──────────────────────────────────────────

  /** Send a user message to the AI agent; resolves with { content } or { error }. */
  sendMessage: (text) => ipcRenderer.invoke('send-message', text),

  /** Clear the conversation history. */
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  /** Fetch the current status object. */
  getStatus: () => ipcRenderer.invoke('get-status'),

  /** Start the Discord bot (optional). */
  startDiscord: () => ipcRenderer.invoke('start-discord'),

  /** Open the .env file in the system text editor. */
  openEnvFile: () => ipcRenderer.invoke('open-env-file'),

  // ── Push events (on) ─────────────────────────────────────────────────────

  /** Listen for AI responses pushed from main (e.g. reminders). */
  onAiResponse: (cb) => ipcRenderer.on('ai-response', (_e, data) => cb(data)),

  /** Listen for tool-activity log entries. */
  onToolLog: (cb) => ipcRenderer.on('tool-log', (_e, data) => cb(data)),

  /** Listen for status updates pushed from main. */
  onStatusUpdate: (cb) => ipcRenderer.on('status-update', (_e, data) => cb(data)),

  // ── Cleanup ───────────────────────────────────────────────────────────────

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
