/**
 * tools/web_search.js
 *
 * Uses the DuckDuckGo Instant Answer API (free, no API key required) to return
 * a concise summary about a search query.
 */

export const webSearchTool = {
  name: "web_search",
  description:
    "Search the web for a topic and return a concise summary. " +
    "Good for current events, general facts, and quick lookups. " +
    "Not a full web search — returns instant-answer style results.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type:        "string",
        description: "The search query to look up.",
      },
    },
    required: ["query"],
  },

  async execute({ query }) {
    if (!query?.trim()) return "Error: query cannot be empty.";

    const url =
      "https://api.duckduckgo.com/?" +
      new URLSearchParams({
        q:              query,
        format:         "json",
        no_html:        "1",
        skip_disambig:  "1",
        no_redirect:    "1",
      });

    let data;
    try {
      const res = await fetch(url, {
        headers: { "Accept-Language": "en-US,en;q=0.9" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      return `Error fetching search results: ${err.message}`;
    }

    const parts = [];

    if (data.AbstractText) {
      parts.push(data.AbstractText);
      if (data.AbstractURL) parts.push(`Source: ${data.AbstractURL}`);
    }

    if (data.Answer) {
      parts.push(`Answer: ${data.Answer}`);
    }

    if (data.Definition) {
      parts.push(`Definition: ${data.Definition}`);
    }

    // Related topics as a fallback
    if (parts.length === 0 && data.RelatedTopics?.length) {
      const topics = data.RelatedTopics
        .filter(t => t.Text)
        .slice(0, 4)
        .map(t => `• ${t.Text}`);
      if (topics.length) {
        parts.push("Related results:");
        parts.push(...topics);
      }
    }

    if (parts.length === 0) {
      return `No instant-answer results found for "${query}". Try rephrasing your query.`;
    }

    return parts.join("\n");
  },
};
