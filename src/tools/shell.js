/**
 * tools/shell.js
 *
 * Execute a shell command on the local machine.
 * The agent can use this to inspect the file system, run scripts,
 * check running processes, install packages, compile code, and more.
 *
 * Safety guardrails:
 *  - Commands that match a hardcoded blocklist of destructive patterns are
 *    rejected immediately without execution.
 *  - Hard 30-second timeout.
 *  - stdout + stderr capped at 4 000 characters.
 *  - Always runs in the user's home directory with their PATH.
 */

import { spawnSync } from "child_process";
import { homedir }   from "os";

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT = 4_000;

/**
 * Patterns that are unconditionally refused regardless of context.
 * Keyed by a short reason string for the error message.
 */
const BLOCKED = [
  // Destructive file removal — block rm whenever both -r/-R/--recursive AND -f/--force
  // are present in any order, as separate flags or combined (e.g. -rf, -fr, -Rf, -rFf)
  { re: /\brm\b(?=.*\s-[a-zA-Z]*[rR])(?=.*(\s-[a-zA-Z]*[fF]|\s--force))/,
    reason: "recursive+forced remove is not allowed" },
  { re: /\brm\b(?=.*\s-[a-zA-Z]*[fF])(?=.*(\s-[a-zA-Z]*[rR]|\s--recursive))/,
    reason: "recursive+forced remove is not allowed" },
  { re: /\brm\s+--recursive\b/i,  reason: "recursive remove is not allowed" },
  { re: /\brm\s+--force\b/i,      reason: "forced remove is not allowed" },
  // Low-level disk operations
  { re: /\bdd\s+if=/i,            reason: "dd disk writes are not allowed" },
  { re: /\bmkfs\b/i,              reason: "filesystem formatting is not allowed" },
  { re: /\bfdisk\b/i,             reason: "partition editing is not allowed" },
  // Privilege escalation
  { re: /\bsudo\b/i,              reason: "sudo is not allowed" },
  { re: /\bsu\s+(-|root)/i,       reason: "su is not allowed" },
  // System power / init
  { re: /\b(reboot|shutdown|poweroff|halt)\b/i, reason: "system power commands are not allowed" },
  // Redirecting to raw disk / special device nodes (e.g. > /dev/sda, > /dev/nvme0)
  { re: />\s*\/dev\/(s?d[a-z]|nvme|xvd)/i,
    reason: "writing to raw device nodes is not allowed" },
  // Modifying /etc auth files
  { re: /\bpasswd\b/i,            reason: "passwd is not allowed" },
  { re: /\bchpasswd\b/i,          reason: "chpasswd is not allowed" },
];

function checkBlocked(command) {
  for (const { re, reason } of BLOCKED) {
    if (re.test(command)) return reason;
  }
  return null;
}

export const shellTool = {
  name: "shell",
  description:
    "Run a shell command on the user's local machine and return its output. " +
    "Use this to inspect files, list directories, run scripts, check processes, " +
    "query git, compile code, manage packages, and more. " +
    "Destructive operations (rm -rf, sudo, reboot, dd, mkfs, passwd) are blocked.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type:        "string",
        description: "The shell command to execute, e.g. \"ls -la ~\" or \"git log --oneline -10\".",
      },
    },
    required: ["command"],
  },

  execute({ command }) {
    if (!command?.trim()) return "Error: command cannot be empty.";

    const blocked = checkBlocked(command);
    if (blocked) {
      return `Command refused: ${blocked}.`;
    }

    const result = spawnSync("bash", ["-c", command], {
      timeout:   TIMEOUT_MS,
      encoding:  "utf8",
      maxBuffer: MAX_OUTPUT * 2,
      cwd:       homedir(),
      env:       { ...process.env },
    });

    if (result.error) {
      if (result.error.code === "ETIMEDOUT") {
        return `Error: command timed out after ${TIMEOUT_MS / 1000} seconds.`;
      }
      return `Error starting shell: ${result.error.message}`;
    }

    const stdout = (result.stdout || "").trim();
    const stderr = (result.stderr || "").trim();
    const parts  = [stdout, stderr].filter(Boolean).join("\n\n");
    const output = parts || "(no output)";

    const truncated = output.length > MAX_OUTPUT
      ? output.slice(0, MAX_OUTPUT) + "\n…(output truncated)"
      : output;

    if (result.status !== 0) {
      return `Exit code ${result.status}:\n${truncated}`;
    }
    return truncated;
  },
};
