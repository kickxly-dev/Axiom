/**
 * index.js — Entry point for Axiom AI Brain
 *
 * Loads environment variables, then starts in the selected mode:
 *   - MODE=discord (default) — starts the Discord bot
 *   - MODE=desktop           — starts the interactive terminal (REPL) interface
 *   - MODE=api               — starts the HTTP API server
 */

import "dotenv/config";

const mode = (process.env.MODE || "discord").toLowerCase();

if (mode === "desktop") {
  console.log("🚀 Starting Axiom AI Brain (Desktop Mode)...");
  const { startDesktop } = await import("./desktop.js");
  startDesktop();
} else if (mode === "api") {
  console.log("🚀 Starting Axiom API Server...");
  const { startApiServer } = await import("./api/server.js");
  startApiServer().catch((err) => {
    console.error("Fatal error starting API server:", err);
    process.exit(1);
  });
} else {
  console.log("🚀 Starting Axiom AI Brain (Discord Mode)...");
  const { startBot } = await import("./bot.js");
  startBot().catch((err) => {
    console.error("Fatal error starting bot:", err);
    process.exit(1);
  });
}
