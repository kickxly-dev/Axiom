/**
 * tools/notes.js
 *
 * Agent scratchpad — in-memory key/value store the agent can use to
 * save intermediate results, track progress on multi-step tasks,
 * and retrieve information across tool rounds within a session.
 *
 * Notes survive as long as the process runs (they are NOT persisted
 * to disk).  The agent should use this for working memory: jot down
 * a partial result, then look it up in a later round.
 */

/** @type {Map<string, string>} */
const store = new Map();

export const notesTool = {
  name: "notes",
  description:
    "Agent scratchpad for working memory across tool rounds. " +
    "Use this to save intermediate results, track multi-step plans, " +
    "or store data you need to refer back to later in the same conversation. " +
    "Supports write, read, list, and delete operations.",
  parameters: {
    type: "object",
    properties: {
      operation: {
        type:        "string",
        enum:        ["write", "read", "list", "delete", "clear"],
        description:
          "write — create or overwrite a note; " +
          "read — retrieve a note by key; " +
          "list — show all saved note keys (and a preview of each); " +
          "delete — remove a single note; " +
          "clear — wipe all notes.",
      },
      key: {
        type:        "string",
        description: "Identifier for the note (required for write / read / delete).",
      },
      content: {
        type:        "string",
        description: "Text to save (required for write).",
      },
    },
    required: ["operation"],
  },

  execute({ operation, key, content }) {
    switch (operation) {
      case "write": {
        if (!key?.trim())     return "Error: key is required for write.";
        if (content === undefined) return "Error: content is required for write.";
        store.set(key.trim(), String(content));
        return `Note "${key.trim()}" saved (${String(content).length} chars).`;
      }

      case "read": {
        if (!key?.trim()) return "Error: key is required for read.";
        const val = store.get(key.trim());
        if (val === undefined) return `Note "${key.trim()}" not found. Use list to see all keys.`;
        return val;
      }

      case "list": {
        if (store.size === 0) return "No notes saved yet.";
        const lines = [];
        for (const [k, v] of store) {
          const preview = v.length > 80 ? v.slice(0, 80) + "…" : v;
          lines.push(`• ${k}: ${preview}`);
        }
        return `Saved notes (${store.size}):\n${lines.join("\n")}`;
      }

      case "delete": {
        if (!key?.trim()) return "Error: key is required for delete.";
        if (!store.has(key.trim())) return `Note "${key.trim()}" not found.`;
        store.delete(key.trim());
        return `Note "${key.trim()}" deleted.`;
      }

      case "clear": {
        const count = store.size;
        store.clear();
        return `Cleared ${count} note(s).`;
      }

      default:
        return `Unknown operation "${operation}". Use write, read, list, delete, or clear.`;
    }
  },
};
