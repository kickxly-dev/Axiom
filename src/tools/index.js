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
 *   - parameters: JSON Schema object (for Gemini function declarations)
 *   - execute(params, context?): string | Promise<string>
 */

import { calculatorTool } from "./calculator.js";
import { datetimeTool } from "./datetime.js";
import { remindTool } from "./remind.js";
import { defineTool } from "./define.js";

/** @type {Array<import("./types.js").Tool>} */
export const tools = [calculatorTool, datetimeTool, remindTool, defineTool];

/**
 * Build the Gemini-compatible function declarations array.
 * @returns {Array<{ name: string, description: string, parameters: object }>}
 */
export function getFunctionDeclarations() {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
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
