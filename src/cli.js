#!/usr/bin/env node
/**
 * src/cli.js
 *
 * Axiom OS CLI — interact with the core AI agent from the terminal.
 *
 * Commands:
 *   axiom chat [message]     — start/continue a chat session
 *   axiom plan <task>        — generate a step-by-step plan
 *   axiom debug <problem>    — analyse and debug a problem
 *   axiom ship <project>     — summarise what needs to happen to ship something
 *   axiom remember <key>=<value>  — store a memory for the CLI user
 *   axiom persona <name>     — switch persona (concise/detailed/coder/coach/roast)
 *   axiom tooltest <tool>    — directly invoke and test a tool
 *
 * Usage:
 *   node src/cli.js chat "What is 15% of 847?"
 *   node src/cli.js plan "build a REST API in Node.js"
 *   node src/cli.js persona coder
 *   node src/cli.js tooltest calculator '{"expression":"2+2"}'
 */

import "dotenv/config";
import { Command } from "commander";
import readline from "readline";
import { processMessage, clearHistory, PERSONAS } from "./agent.js";
import {
  getProfile,
  setPersona,
  setMemory,
  getMemories,
} from "./db/memory.js";
import { getToolByName, getToolDefinitions } from "./tools/index.js";

const CLI_USER_ID   = process.env.CLI_USER_ID || "cli-user";
const CLI_CHANNEL   = `cli-${CLI_USER_ID}`;

// ANSI colour helpers
const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  gray:   "\x1b[90m",
  blue:   "\x1b[34m",
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function startSpinner(label) {
  let i = 0;
  const timer = setInterval(() => {
    const frame = SPINNER_FRAMES[i % SPINNER_FRAMES.length];
    process.stdout.write(`\r${c.dim}${frame} ${label}${c.reset}`);
    i++;
  }, 80);
  return () => {
    clearInterval(timer);
    process.stdout.write("\r\x1b[K");
  };
}

/**
 * Build a context object enriched with the CLI user's persona and memories.
 */
function buildContext() {
  const profile = getProfile(CLI_USER_ID);
  const persona = PERSONAS[profile.persona] || PERSONAS.concise;
  const memories = getMemories(CLI_USER_ID);
  const memoryContext =
    memories.length > 0
      ? `\n\nUser memory:\n${memories.map((m) => `- ${m.key}: ${m.value}`).join("\n")}`
      : "";
  return {
    personaPrompt: persona.instruction,
    memoryContext,
    userId: CLI_USER_ID,
  };
}

/**
 * Send a message to the agent and print the result.
 */
async function ask(message, prefix = "") {
  const stop = startSpinner("thinking…");
  try {
    const reply = await processMessage(CLI_CHANNEL, prefix + message, buildContext());
    stop();
    console.log(`\n${c.green}${c.bold}Axiom${c.reset} ${c.green}›${c.reset} ${reply}\n`);
    return reply;
  } catch (err) {
    stop();
    console.error(`\n${c.red}${c.bold}Error${c.reset} ${c.red}›${c.reset} ${err.message}\n`);
    process.exit(1);
  }
}

// ── Commander program ─────────────────────────────────────────────────────────

const program = new Command();

program
  .name("axiom")
  .description("Axiom OS CLI — AI agent at your command line")
  .version("2.0.0");

// ── axiom chat ────────────────────────────────────────────────────────────────

program
  .command("chat [message...]")
  .description("Chat with Axiom. Omit message to enter interactive REPL.")
  .action(async (messageParts) => {
    if (messageParts && messageParts.length > 0) {
      await ask(messageParts.join(" "));
    } else {
      // Interactive REPL
      const profile = getProfile(CLI_USER_ID);
      console.log(
        `\n${c.cyan}${c.bold}Axiom Chat${c.reset} ${c.dim}(persona: ${profile.persona} | type "exit" to quit)${c.reset}\n`
      );

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
      rl.on("close", () => { console.log(`\n${c.yellow}  Goodbye! 👋${c.reset}\n`); process.exit(0); });

      const prompt = () => rl.question(`${c.cyan}${c.bold}You${c.reset} ${c.cyan}›${c.reset} `, async (raw) => {
        const text = raw.trim();
        if (!text) { prompt(); return; }
        if (text === "exit" || text === "quit") { rl.close(); return; }
        if (text === "clear") {
          clearHistory(CLI_CHANNEL);
          console.log(`\n${c.yellow}  🧹 Cleared.${c.reset}\n`);
          prompt(); return;
        }
        await ask(text);
        prompt();
      });
      prompt();
    }
  });

// ── axiom plan ────────────────────────────────────────────────────────────────

program
  .command("plan <task...>")
  .description("Generate a structured, step-by-step plan for a task")
  .action(async (taskParts) => {
    const task = taskParts.join(" ");
    await ask(task, "Create a detailed, numbered step-by-step plan for the following task: ");
  });

// ── axiom debug ───────────────────────────────────────────────────────────────

program
  .command("debug <problem...>")
  .description("Analyse and debug a problem or error")
  .action(async (problemParts) => {
    const problem = problemParts.join(" ");
    await ask(problem, "Analyse the following problem and provide root cause analysis and actionable fixes: ");
  });

// ── axiom ship ────────────────────────────────────────────────────────────────

program
  .command("ship <project...>")
  .description("Summarise what's needed to ship a project or feature")
  .action(async (projectParts) => {
    const project = projectParts.join(" ");
    await ask(
      project,
      "You are a senior engineer. List everything required to ship the following project or feature — " +
      "including code, tests, docs, deployment, and any blockers: "
    );
  });

// ── axiom remember ────────────────────────────────────────────────────────────

program
  .command("remember <entry>")
  .description('Store a memory. Format: key=value  (e.g. "name=Alice" or "project=Axiom")')
  .action((entry) => {
    const sep = entry.indexOf("=");
    if (sep === -1) {
      console.error(`${c.red}Error:${c.reset} Use the format key=value`);
      process.exit(1);
    }
    const key   = entry.slice(0, sep).trim();
    const value = entry.slice(sep + 1).trim();
    setMemory(CLI_USER_ID, key, value);
    console.log(`${c.green}✓${c.reset} Remembered: ${c.bold}${key}${c.reset} = ${value}`);
  });

// ── axiom persona ─────────────────────────────────────────────────────────────

program
  .command("persona [name]")
  .description(`Set or show the active persona. Options: ${Object.keys(PERSONAS).join(", ")}`)
  .action((name) => {
    if (!name) {
      const current = getProfile(CLI_USER_ID).persona;
      console.log(`\nCurrent persona: ${c.cyan}${c.bold}${current}${c.reset}\n`);
      console.log("Available personas:");
      for (const [key, p] of Object.entries(PERSONAS)) {
        const marker = key === current ? `${c.green}●${c.reset} ` : "  ";
        console.log(`${marker}${c.cyan}${key}${c.reset} — ${p.label}`);
      }
      console.log();
      return;
    }
    if (!PERSONAS[name]) {
      console.error(`${c.red}Unknown persona "${name}". Options: ${Object.keys(PERSONAS).join(", ")}${c.reset}`);
      process.exit(1);
    }
    setPersona(CLI_USER_ID, name);
    console.log(`${c.green}✓${c.reset} Persona set to ${c.cyan}${c.bold}${name}${c.reset} — ${PERSONAS[name].label}`);
  });

// ── axiom tooltest ────────────────────────────────────────────────────────────

program
  .command("tooltest [name] [params]")
  .description("Directly invoke a tool by name for testing. Omit name to list all tools.")
  .action(async (name, rawParams) => {
    if (!name) {
      const tools = getToolDefinitions();
      console.log(`\n${c.bold}Available tools (${tools.length}):${c.reset}\n`);
      for (const t of tools) {
        console.log(`  ${c.cyan}${t.function.name}${c.reset} — ${t.function.description}`);
      }
      console.log();
      return;
    }

    const tool = getToolByName(name);
    if (!tool) {
      console.error(`${c.red}Tool "${name}" not found.${c.reset}`);
      process.exit(1);
    }

    let params = {};
    if (rawParams) {
      try { params = JSON.parse(rawParams); }
      catch { console.error(`${c.red}Invalid JSON params: ${rawParams}${c.reset}`); process.exit(1); }
    }

    console.log(`\n${c.dim}Invoking tool: ${c.bold}${name}${c.reset} ${c.dim}with params:${c.reset} ${JSON.stringify(params)}\n`);
    const stop = startSpinner("executing…");
    const t0 = Date.now();
    try {
      const result = await Promise.resolve(tool.execute(params, { channelId: "cli-tooltest" }));
      stop();
      console.log(`${c.green}✓${c.reset} Result (${Date.now() - t0}ms):\n`);
      console.log(result);
      console.log();
    } catch (err) {
      stop();
      console.error(`${c.red}✗${c.reset} Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
