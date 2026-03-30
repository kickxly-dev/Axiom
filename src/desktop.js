/**
 * desktop.js
 *
 * A simple interactive terminal (REPL) interface for Axiom.
 * Run with:  MODE=desktop npm start
 *
 * Type a message and press Enter to chat.
 * Type "clear" to reset the conversation.
 * Type "exit" or press Ctrl+C to quit.
 */

import readline from "readline";
import { processMessage, clearHistory } from "./agent.js";

const CHANNEL_ID = "desktop";

/**
 * Start the desktop REPL.
 */
export function startDesktop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Axiom 🧠  —  Desktop Mode              ║");
  console.log("║   Type your message and press Enter.     ║");
  console.log('║   Type "clear" to reset conversation.   ║');
  console.log('║   Type "exit" or press Ctrl+C to quit.  ║');
  console.log("╚══════════════════════════════════════════╝");
  console.log();

  const prompt = () => rl.question("You: ", handleInput);

  async function handleInput(input) {
    const text = input.trim();

    if (!text) {
      prompt();
      return;
    }

    if (text.toLowerCase() === "exit") {
      console.log("Goodbye! 👋");
      rl.close();
      process.exit(0);
    }

    if (text.toLowerCase() === "clear") {
      clearHistory(CHANNEL_ID);
      console.log("🧹 Conversation history cleared!\n");
      prompt();
      return;
    }

    process.stdout.write("Axiom: thinking...\r");
    try {
      const reply = await processMessage(CHANNEL_ID, text);
      process.stdout.write("                    \r"); // clear the thinking line
      console.log(`Axiom: ${reply}\n`);
    } catch (err) {
      process.stdout.write("                    \r"); // clear the thinking line
      console.error(`Axiom: ❌ Error — ${err.message}\n`);
    }

    prompt();
  }

  prompt();
}
