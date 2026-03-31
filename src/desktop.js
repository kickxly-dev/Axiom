/**
 * desktop.js
 *
 * Polished interactive terminal (REPL) interface for Axiom.
 * Run with:  MODE=desktop npm start
 */

import readline from "readline";
import { processMessage, clearHistory } from "./agent.js";

const CHANNEL_ID = "desktop";

// ANSI escape codes — no external dependencies needed.
const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  gray:    "\x1b[90m",
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Show a braille-dot spinner in the current line.
 * Returns a stop function that clears the line.
 */
function startSpinner(label) {
  let i = 0;
  const timer = setInterval(() => {
    const frame = SPINNER_FRAMES[i % SPINNER_FRAMES.length];
    process.stdout.write(`\r${c.dim}${frame} ${label}${c.reset}`);
    i++;
  }, 80);
  return () => {
    clearInterval(timer);
    process.stdout.write("\r\x1b[K"); // move to column 0 and erase to end of line
  };
}

function printBanner() {
  console.log();
  console.log(`${c.cyan}${c.bold}  ╔══════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ║       Axiom 🧠  —  Desktop Mode          ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ╚══════════════════════════════════════════╝${c.reset}`);
  console.log();
  console.log(`${c.gray}  Model    ${c.reset}${process.env.OLLAMA_MODEL || "phi3:mini"}`);
  console.log(`${c.gray}  Commands ${c.reset}${c.cyan}clear${c.reset}  ${c.cyan}help${c.reset}  ${c.cyan}exit${c.reset}`);
  console.log();
}

function printHelp() {
  console.log();
  console.log(`${c.bold}  Commands${c.reset}`);
  console.log(`  ${c.cyan}clear${c.reset}   reset conversation history`);
  console.log(`  ${c.cyan}help${c.reset}    show this message`);
  console.log(`  ${c.cyan}exit${c.reset}    quit Axiom`);
  console.log();
  console.log(`${c.bold}  Example prompts${c.reset}`);
  console.log(`  ${c.gray}What is 15% of 847?${c.reset}`);
  console.log(`  ${c.gray}What time is it in Tokyo?${c.reset}`);
  console.log(`  ${c.gray}Remind me in 5 minutes to take a break${c.reset}`);
  console.log(`  ${c.gray}Define "ephemeral"${c.reset}`);
  console.log(`  ${c.gray}Tell me a joke${c.reset}`);
  console.log(`  ${c.gray}Flip a coin${c.reset}`);
  console.log(`  ${c.gray}Convert 100 miles to km${c.reset}`);
  console.log();
}

/**
 * Start the desktop REPL.
 */
export function startDesktop() {
  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
  });

  // Keep the process alive when there's no pending I/O (e.g. after a tool fires).
  rl.on("close", () => process.exit(0));

  const prompt = () => {
    rl.question(`${c.cyan}${c.bold}You${c.reset} ${c.cyan}›${c.reset} `, handleInput);
  };

  async function handleInput(raw) {
    const text = raw.trim();

    if (!text) {
      prompt();
      return;
    }

    switch (text.toLowerCase()) {
      case "exit":
      case "quit":
        console.log(`\n${c.yellow}  Goodbye! 👋${c.reset}\n`);
        rl.close();
        return;

      case "clear":
        clearHistory(CHANNEL_ID);
        console.log(`\n${c.yellow}  🧹 Conversation cleared.${c.reset}\n`);
        prompt();
        return;

      case "help":
        printHelp();
        prompt();
        return;
    }

    const stopSpinner = startSpinner("thinking…");
    try {
      const reply = await processMessage(CHANNEL_ID, text);
      stopSpinner();
      console.log(`\n${c.green}${c.bold}Axiom${c.reset} ${c.green}›${c.reset} ${reply}\n`);
    } catch (err) {
      stopSpinner();
      console.error(`\n${c.red}${c.bold}Error${c.reset} ${c.red}›${c.reset} ${err.message}\n`);
    }

    prompt();
  }

  prompt();
}
