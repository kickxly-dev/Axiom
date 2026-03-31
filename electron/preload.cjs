"use strict";

/**
 * electron/preload.cjs
 *
 * Context-bridge — exposes a narrow, safe API (window.axiom) to the renderer.
 * Nothing from Node or Electron leaks into the renderer's JS scope.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("axiom", {
  // ── window controls ────────────────────────────────────────────────────────
  minimize()  { ipcRenderer.send("window:minimize"); },
  maximize()  { ipcRenderer.send("window:maximize"); },
  close()     { ipcRenderer.send("window:close"); },

  // ── sessions ───────────────────────────────────────────────────────────────
  listSessions()          { return ipcRenderer.invoke("sessions:list"); },
  saveSessions(sessions)  { return ipcRenderer.invoke("sessions:save", sessions); },

  // ── chat ───────────────────────────────────────────────────────────────────
  send(sessionId, message) {
    return ipcRenderer.invoke("chat:send", { sessionId, message });
  },

  clearHistory(sessionId) {
    return ipcRenderer.invoke("chat:clear", { sessionId });
  },

  // ── streaming callbacks ────────────────────────────────────────────────────
  /** Register a handler for streaming text chunks. Returns a remove function. */
  onChunk(fn) {
    const wrapper = (_e, data) => fn(data);
    ipcRenderer.on("chat:chunk", wrapper);
    return () => ipcRenderer.removeListener("chat:chunk", wrapper);
  },

  /** Register a handler for tool-call notifications. Returns a remove function. */
  onToolCall(fn) {
    const wrapper = (_e, data) => fn(data);
    ipcRenderer.on("chat:tool-call", wrapper);
    return () => ipcRenderer.removeListener("chat:tool-call", wrapper);
  },

  /** Register a handler for tool-result notifications. Returns a remove function. */
  onToolResult(fn) {
    const wrapper = (_e, data) => fn(data);
    ipcRenderer.on("chat:tool-result", wrapper);
    return () => ipcRenderer.removeListener("chat:tool-result", wrapper);
  },

  // ── misc ───────────────────────────────────────────────────────────────────
  openExternal(url) { ipcRenderer.send("shell:open-external", url); },
});
