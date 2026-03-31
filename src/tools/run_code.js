/**
 * tools/run_code.js
 *
 * Execute short JavaScript (Node.js) or Python 3 code snippets in a
 * sandboxed child process.  The agent can use this to compute things,
 * transform data, solve algorithms, and verify logic instead of
 * guessing at numeric or programmatic answers.
 *
 * Safety:
 *  - Code is written to a temp file and run as a subprocess.
 *  - Hard 15-second timeout.
 *  - stdout + stderr are capped at 4 000 characters.
 *  - The temp file is always deleted after execution.
 */

import { spawnSync }          from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join }               from "path";
import { tmpdir, homedir }    from "os";

const TIMEOUT_MS  = 15_000;
const MAX_OUTPUT  = 4_000;

export const runCodeTool = {
  name: "run_code",
  description:
    "Write and execute a code snippet. Supports JavaScript (Node.js) and Python 3. " +
    "Use this whenever a task involves calculation, data processing, algorithms, " +
    "string manipulation, or anything that benefits from actual code execution " +
    "rather than estimation. Returns the combined stdout / stderr.",
  parameters: {
    type: "object",
    properties: {
      language: {
        type:        "string",
        enum:        ["javascript", "python"],
        description: "Language to run: \"javascript\" (Node.js) or \"python\" (Python 3).",
      },
      code: {
        type:        "string",
        description:
          "The complete, self-contained code to execute. " +
          "Use console.log() / print() to produce output.",
      },
    },
    required: ["language", "code"],
  },

  execute({ language, code }) {
    if (!code?.trim())     return "Error: code cannot be empty.";
    if (!language?.trim()) return "Error: language must be \"javascript\" or \"python\".";

    const ext     = language === "python" ? "py" : "js";
    const tmpFile = join(tmpdir(), `axiom-run-${Date.now()}-${process.pid}.${ext}`);

    try {
      writeFileSync(tmpFile, code, "utf8");

      const [bin, args] =
        language === "python"
          ? ["python3", [tmpFile]]
          : ["node",    [tmpFile]];

      const result = spawnSync(bin, args, {
        timeout:   TIMEOUT_MS,
        encoding:  "utf8",
        maxBuffer: MAX_OUTPUT * 2,
        cwd:       homedir(),
        env:       {
          ...process.env,
          // Suppress color codes that clutter output
          NO_COLOR: "1",
          FORCE_COLOR: "0",
        },
      });

      // Handle hard timeout / spawn errors
      if (result.error) {
        if (result.error.code === "ETIMEDOUT") {
          return `Error: execution timed out after ${TIMEOUT_MS / 1000} seconds.`;
        }
        return `Error starting process: ${result.error.message}`;
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
    } finally {
      try { unlinkSync(tmpFile); } catch { /* best effort */ }
    }
  },
};
