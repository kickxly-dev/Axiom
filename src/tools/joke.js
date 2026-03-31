/**
 * Tool: joke
 * Fetches a random joke from the free JokeAPI (no key required).
 */
export const jokeTool = {
  name: "joke",
  description:
    "Fetches a random joke, optionally filtered by category. " +
    "Use this when the user asks for a joke, wants to hear something funny, or asks you to entertain them.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["Any", "Programming", "Misc", "Pun", "Spooky", "Christmas"],
        description:
          "The joke category. Defaults to 'Any'. " +
          "Use 'Programming' for dev/tech jokes, 'Pun' for wordplay, etc.",
      },
    },
    required: [],
  },

  /**
   * Execute the tool.
   * @param {{ category?: string }} params
   * @returns {Promise<string>}
   */
  async execute({ category = "Any" } = {}) {
    const VALID = ["Any", "Programming", "Misc", "Pun", "Spooky", "Christmas"];
    const cat = VALID.includes(category) ? category : "Any";

    try {
      const url =
        `https://v2.jokeapi.dev/joke/${encodeURIComponent(cat)}` +
        `?blacklistFlags=nsfw,racist,sexist,explicit&safe-mode`;
      const res = await fetch(url);
      if (!res.ok) return "Couldn't fetch a joke right now — try again in a moment.";

      const data = await res.json();
      if (data.error) return "No joke available for that category.";

      return data.type === "single"
        ? data.joke
        : `${data.setup}\n${data.delivery}`;
    } catch (err) {
      return `Error fetching joke: ${err.message}`;
    }
  },
};
