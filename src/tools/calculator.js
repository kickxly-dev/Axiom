/**
 * Tool: calculator
 * Evaluates basic math expressions safely.
 */
export const calculatorTool = {
  name: "calculator",
  description:
    "Evaluates a mathematical expression and returns the result. " +
    "Supports +, -, *, /, **, %, and parentheses. " +
    "Use this whenever the user asks you to calculate something.",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description:
          "The math expression to evaluate, e.g. '(3 + 5) * 2' or '100 / 4'.",
      },
    },
    required: ["expression"],
  },

  /**
   * Execute the tool.
   * @param {{ expression: string }} params
   * @returns {string} Result or error message.
   */
  execute({ expression }) {
    try {
      // Only allow safe math characters to prevent code injection.
      // The character class includes * (so ** is also valid) and ^ (user
      // convenience — replaced with ** below before evaluation).
      if (!/^[\d\s+\-*/.%^()]+$/.test(expression)) {
        return "Error: expression contains disallowed characters.";
      }
      // Replace ^ with ** for exponentiation (e.g. "2^10" → "2**10")
      const sanitized = expression.replace(/\^/g, "**");
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== "number" || !isFinite(result)) {
        return "Error: result is not a finite number.";
      }
      return `${expression} = ${result}`;
    } catch (err) {
      return `Error evaluating expression: ${err.message}`;
    }
  },
};
