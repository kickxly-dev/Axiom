/**
 * Tool registry — all available tools are registered here.
 *
 * To add a new tool:
 *   1. Create a file in src/tools/yourTool.js exporting a tool object.
 *   2. Import it below and add it to the `tools` array.
 *
 * A tool object must have:
 *   - name: string
 *   - description: string
 *   - parameters: JSON Schema object
 *   - execute(params, context?): string | Promise<string>
 */

import { calculatorTool } from "./calculator.js";
import { datetimeTool } from "./datetime.js";
import { remindTool } from "./remind.js";
import { defineTool } from "./define.js";
import { jokeTool } from "./joke.js";
import { coinflipTool } from "./coinflip.js";
import { unitconvertTool } from "./unitconvert.js";
import { webSearchTool } from "./web_search.js";
import { weatherTool } from "./weather.js";
import { sysinfoTool } from "./sysinfo.js";
import { filesTool } from "./files.js";
import { runCodeTool } from "./run_code.js";
import { shellTool } from "./shell.js";
import { notesTool } from "./notes.js";

/** @type {Array<import("./types.js").Tool>} */
export const tools = [
  calculatorTool,
  datetimeTool,
  remindTool,
  defineTool,
  jokeTool,
  coinflipTool,
  unitconvertTool,
  webSearchTool,
  weatherTool,
  sysinfoTool,
  filesTool,
  runCodeTool,
  shellTool,
  notesTool,
];

/**
 * Build the Ollama-compatible tool definitions array.
 * @returns {Array<{ type: "function", function: { name: string, description: string, parameters: object } }>}
 */
export function getToolDefinitions() {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * Find a tool by name.
 * @param {string} name
 * @returns {import("./types.js").Tool | undefined}
 */
export function getToolByName(name) {
  return tools.find((t) => t.name === name);
}
