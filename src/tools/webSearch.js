import { USER_AGENT } from "../constants.js";

/**
 * Tool: webSearch
 *
 * Searches the web using the DuckDuckGo Instant Answer API.
 * Free — no API key required.
 *
 * Returns the best available answer: a direct answer, an abstract summary,
 * or the top related topics.
 */
export const webSearchTool = {
  name: "web_search",
  description:
    "Searches the web for information using DuckDuckGo and returns a summary of the results. " +
    "Use this when the user asks a question that requires up-to-date or general knowledge " +
    "that you may not have, such as recent events, facts, people, places, or concepts.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to look up, e.g. 'latest news about AI' or 'who is Elon Musk'.",
      },
    },
    required: ["query"],
  },

  /**
   * Execute the tool.
   * @param {{ query: string }} params
   * @returns {Promise<string>}
   */
  async execute({ query }) {
    try {
      const encoded = encodeURIComponent(query.trim());
      const url =
        `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;

      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (!res.ok) {
        return `Search request failed with status ${res.status}.`;
      }

      const data = await res.json();
      const lines = [];

      // Direct answer (e.g. "What is 2+2?")
      if (data.Answer) {
        lines.push(`**Answer:** ${data.Answer}`);
      }

      // Abstract summary from a knowledge source (Wikipedia, etc.)
      if (data.AbstractText) {
        lines.push(`**Summary (${data.AbstractSource || "DuckDuckGo"}):**`);
        // Trim to a reasonable length
        const abstract =
          data.AbstractText.length > 600
            ? data.AbstractText.slice(0, 600) + "…"
            : data.AbstractText;
        lines.push(abstract);
        if (data.AbstractURL) {
          lines.push(`Source: ${data.AbstractURL}`);
        }
      }

      // Top related topics (if no abstract was found)
      if (lines.length === 0 && data.RelatedTopics?.length > 0) {
        lines.push(`**Top results for "${query}":**`);
        for (const topic of data.RelatedTopics.slice(0, 3)) {
          if (topic.Text) {
            lines.push(`• ${topic.Text}`);
          } else if (topic.Topics) {
            // Sub-category group — grab the first item
            for (const sub of topic.Topics.slice(0, 2)) {
              if (sub.Text) lines.push(`• ${sub.Text}`);
            }
          }
        }
      }

      if (lines.length === 0) {
        return `No results found for "${query}". Try a different search query.`;
      }

      return lines.join("\n");
    } catch (err) {
      return `Error performing web search: ${err.message}`;
    }
  },
};
