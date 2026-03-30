/**
 * index.js — Entry point for Axiom AI Brain
 *
 * Loads environment variables, then starts the Discord bot.
 */

import "dotenv/config";
import { startBot } from "./bot.js";

console.log("🚀 Starting Axiom AI Brain...");

startBot().catch((err) => {
  console.error("Fatal error starting bot:", err);
  process.exit(1);
});
