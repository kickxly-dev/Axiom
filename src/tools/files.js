/**
 * tools/files.js
 *
 * Provides safe, read-only file system operations.
 * Write access is intentionally excluded to prevent accidental data loss.
 */

import fs   from "fs";
import path from "path";
import os   from "os";

const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB

/** Resolve and validate a path, restricting it to the user's home directory. */
function resolveSafe(inputPath) {
  // Expand ~
  const expanded = inputPath.startsWith("~")
    ? path.join(os.homedir(), inputPath.slice(1))
    : inputPath;

  const resolved = path.resolve(expanded);

  // Restrict to home directory only for safety
  const home = os.homedir();
  if (!resolved.startsWith(home + path.sep) && resolved !== home) {
    throw new Error(
      `Access denied — only paths within your home directory (~) are allowed.`
    );
  }

  return resolved;
}

export const filesTool = {
  name: "file_read",
  description:
    "Read the contents of a text file on the local machine. " +
    "Supports any plain text file (code, logs, configs, notes, etc.). " +
    "Restricted to the user's home directory.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type:        "string",
        description: 'Absolute or home-relative path to the file, e.g. "~/Documents/notes.txt".',
      },
      max_lines: {
        type:        "integer",
        description: "Maximum number of lines to return (default 200, max 1000).",
      },
    },
    required: ["path"],
  },

  execute({ path: inputPath, max_lines = 200 }) {
    if (!inputPath?.trim()) return "Error: path cannot be empty.";

    let resolved;
    try {
      resolved = resolveSafe(inputPath);
    } catch (err) {
      return `Error: ${err.message}`;
    }

    if (!fs.existsSync(resolved)) {
      return `File not found: ${resolved}`;
    }

    const stat = fs.statSync(resolved);

    if (stat.isDirectory()) {
      // List directory contents instead
      try {
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        const lines = entries.map(e => {
          const suffix = e.isDirectory() ? "/" : "";
          return `${e.name}${suffix}`;
        });
        return `Directory listing for ${resolved}:\n${lines.join("\n")}`;
      } catch (err) {
        return `Error reading directory: ${err.message}`;
      }
    }

    if (stat.size > MAX_FILE_SIZE_BYTES) {
      return `File is too large to read (${(stat.size / 1024).toFixed(0)} KB > ${MAX_FILE_SIZE_BYTES / 1024} KB limit).`;
    }

    try {
      const content = fs.readFileSync(resolved, "utf8");
      const limit   = Math.min(Math.max(1, max_lines), 1000);
      const allLines = content.split("\n");
      const truncated = allLines.slice(0, limit);
      const suffix = allLines.length > limit
        ? `\n… (${allLines.length - limit} more lines not shown)`
        : "";
      return `Contents of ${resolved}:\n\`\`\`\n${truncated.join("\n")}${suffix}\n\`\`\``;
    } catch (err) {
      return `Error reading file: ${err.message}`;
    }
  },
};
