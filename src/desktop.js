/**
 * desktop.js
 *
 * Polished interactive terminal (REPL) interface for Axiom.
 * Run with:  MODE=desktop npm start
 */

import readline from "readline";
import { processMessageStream, clearHistory, getConfigSnapshot } from "./agent.js";
import { tools } from "./tools/index.js";

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
  magenta: "\x1b[35m",
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
  const cfg = getConfigSnapshot();
  console.log();
  console.log(`${c.cyan}${c.bold}  ╔══════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ║       Axiom 🧠  —  Desktop Mode          ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ╚══════════════════════════════════════════╝${c.reset}`);
  console.log();
  console.log(`${c.gray}  Model     ${c.reset}${cfg.model}`);
  console.log(`${c.gray}  Verbosity ${c.reset}${cfg.verbosity}`);
  console.log(`${c.gray}  Commands  ${c.reset}${c.cyan}clear${c.reset}  ${c.cyan}tools${c.reset}  ${c.cyan}help${c.reset}  ${c.cyan}exit${c.reset}`);
  console.log();
}

function printHelp() {
  console.log();
  console.log(`${c.bold}  Commands${c.reset}`);
  console.log(`  ${c.cyan}clear${c.reset}   reset conversation history`);
  console.log(`  ${c.cyan}tools${c.reset}   list all available tools`);
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
  console.log(`  ${c.gray}What's the weather in London?${c.reset}`);
  console.log(`  ${c.gray}Write Python code to print the first 20 primes${c.reset}`);
  console.log(`  ${c.gray}Run: ls -la ~${c.reset}`);
  console.log();
}

function printTools() {
  console.log();
  console.log(`${c.bold}  Available tools (${tools.length})${c.reset}`);
  for (const tool of tools) {
    const desc = tool.description.split(".")[0].trim(); // first sentence
    console.log(`  ${c.cyan}${tool.name.padEnd(16)}${c.reset}${c.gray}${desc}${c.reset}`);
  }
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

      case "tools":
        printTools();
        prompt();
        return;
    }

    // ── streaming response ──────────────────────────────────────────────────
    const stopSpinner = startSpinner("thinking…");
    let spinnerStopped = false;
    let streamStarted  = false;
    let lastChunkNL    = false; // did the last chunk end with a newline?

    function ensureSpinnerStopped() {
      if (!spinnerStopped) {
        stopSpinner();
        spinnerStopped = true;
      }
    }

    try {
      const reply = await processMessageStream(CHANNEL_ID, text, {
        onChunk(chunk) {
          ensureSpinnerStopped();
          if (!streamStarted) {
            process.stdout.write(
              `\n${c.green}${c.bold}Axiom${c.reset} ${c.green}›${c.reset} `
            );
            streamStarted = true;
          }
          process.stdout.write(chunk);
          lastChunkNL = chunk.endsWith("\n");
        },

        onToolCall(name) {
          ensureSpinnerStopped();
          // Start fresh line for tool indicator
          if (streamStarted && !lastChunkNL) process.stdout.write("\n");
          streamStarted = false;
          process.stdout.write(
            `  ${c.magenta}⚙${c.reset} ${c.dim}${name}…${c.reset}\n`
          );
          lastChunkNL = true;
        },

        onToolResult(name) {
          // Overwrite the pending tool line with a completion tick
          process.stdout.write(
            `\r\x1b[K  ${c.dim}✓ ${name}${c.reset}\n`
          );
          lastChunkNL = true;
        },
      });

      ensureSpinnerStopped();

      // If the model returned a reply without any streaming chunks (e.g. plain
      // chat fallback for models that don't support streaming), print it now.
      if (!streamStarted && reply && reply !== "_(No response generated)_") {
        process.stdout.write(
          `\n${c.green}${c.bold}Axiom${c.reset} ${c.green}›${c.reset} ${reply}`
        );
        lastChunkNL = false;
      }

      if (!lastChunkNL) process.stdout.write("\n");
      process.stdout.write("\n");
    } catch (err) {
      ensureSpinnerStopped();
      if (streamStarted && !lastChunkNL) process.stdout.write("\n");
      console.error(
        `\n${c.red}${c.bold}Error${c.reset} ${c.red}›${c.reset} ${err.message}\n`
      );
    }

    prompt();
  }

  prompt();
}
