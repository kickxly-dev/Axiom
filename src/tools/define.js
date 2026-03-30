/**
 * Tool: define
 * Returns a dictionary definition for a word using the free DictionaryAPI.
 */
export const defineTool = {
  name: "define",
  description:
    "Looks up the definition of an English word using a free dictionary API. " +
    "Use this when the user asks what a word means or asks you to define something.",
  parameters: {
    type: "object",
    properties: {
      word: {
        type: "string",
        description: "The English word to look up.",
      },
    },
    required: ["word"],
  },

  /**
   * Execute the tool.
   * @param {{ word: string }} params
   * @returns {Promise<string>}
   */
  async execute({ word }) {
    try {
      const encoded = encodeURIComponent(word.trim().toLowerCase());
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`
      );
      if (!res.ok) {
        return `No definition found for "${word}".`;
      }
      const data = await res.json();
      const entry = data[0];
      const phonetic = entry.phonetic ? ` (${entry.phonetic})` : "";
      const lines = [`**${entry.word}**${phonetic}`];

      for (const meaning of entry.meanings.slice(0, 3)) {
        lines.push(`\n*${meaning.partOfSpeech}*`);
        for (const def of meaning.definitions.slice(0, 2)) {
          lines.push(`• ${def.definition}`);
          if (def.example) lines.push(`  _"${def.example}"_`);
        }
      }
      return lines.join("\n");
    } catch (err) {
      return `Error fetching definition: ${err.message}`;
    }
  },
};
