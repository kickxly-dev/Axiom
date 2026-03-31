/**
 * Tool: coinflip
 * Flips a coin, rolls a die, or picks a random item from a list.
 * Pure logic — no external API needed.
 */
export const coinflipTool = {
  name: "coinflip",
  description:
    "Makes a random choice: flips a coin (heads/tails), rolls a die, or picks randomly from a list of options. " +
    "Use this when the user asks to flip a coin, roll dice, or wants a random choice made for them.",
  parameters: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["coin", "dice", "pick"],
        description:
          "'coin' → heads or tails. " +
          "'dice' → roll a die with N sides (specify 'sides'). " +
          "'pick' → choose randomly from the provided 'options' list.",
      },
      sides: {
        type: "number",
        description: "Number of sides for the die (dice mode only). Defaults to 6.",
      },
      options: {
        type: "array",
        items: { type: "string" },
        description: "List of options to choose from (pick mode only).",
      },
    },
    required: ["mode"],
  },

  /**
   * Execute the tool.
   * @param {{ mode: string, sides?: number, options?: string[] }} params
   * @returns {string}
   */
  execute({ mode, sides = 6, options = [] }) {
    switch (mode) {
      case "coin":
        return Math.random() < 0.5 ? "Heads" : "Tails";

      case "dice": {
        const n = Math.floor(sides);
        if (n < 2 || n > 1000) return "Error: sides must be between 2 and 1000.";
        const roll = Math.floor(Math.random() * n) + 1;
        return `Rolled a d${n}: **${roll}**`;
      }

      case "pick": {
        if (!Array.isArray(options) || options.length === 0) {
          return "Error: provide at least one option for pick mode.";
        }
        const choice = options[Math.floor(Math.random() * options.length)];
        return `I pick: **${choice}**`;
      }

      default:
        return `Error: unknown mode "${mode}". Use "coin", "dice", or "pick".`;
    }
  },
};
