/**
 * Tool: remind
 * Sets a one-shot reminder that fires after a given number of seconds/minutes
 * and pings the user via DM or in the channel where they asked.
 *
 * NOTE: Reminders are in-memory only and will be lost if the bot restarts.
 */

/** @type {Map<string, NodeJS.Timeout>} */
const activeReminders = new Map();

export const remindTool = {
  name: "remind",
  description:
    "Sets a reminder for the user. After the specified delay, Axiom will send them a message. " +
    "Use this when the user says things like 'remind me in 10 minutes to...' or 'set a reminder for...'",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "What to remind the user about.",
      },
      delay_seconds: {
        type: "number",
        description: "How many seconds from now to wait before sending the reminder.",
      },
    },
    required: ["message", "delay_seconds"],
  },

  /**
   * Execute the tool.
   * @param {{ message: string, delay_seconds: number }} params
   * @param {{ sendCallback: (msg: string) => void }} context
   * @returns {string}
   */
  execute({ message, delay_seconds }, context) {
    if (!context?.sendCallback) {
      return "Error: reminder tool requires a sendCallback in context.";
    }
    if (delay_seconds <= 0 || delay_seconds > 86400) {
      return "Error: delay_seconds must be between 1 and 86400 (24 hours).";
    }

    const id = `${Date.now()}-${Math.random()}`;
    const ms = Math.floor(delay_seconds * 1000);

    const timer = setTimeout(() => {
      activeReminders.delete(id);
      const actualSeconds = ms / 1000;
      const minutes = Math.round(actualSeconds / 60);
      const timeLabel =
        actualSeconds < 60
          ? `${actualSeconds}s`
          : `${minutes} minute${minutes !== 1 ? "s" : ""}`;
      context.sendCallback(`⏰ **Reminder** (${timeLabel} ago): ${message}`);
    }, ms);

    activeReminders.set(id, timer);

    const displaySeconds = ms / 1000;
    const minutes = Math.round(displaySeconds / 60);
    const timeLabel =
      displaySeconds < 60
        ? `${displaySeconds} second${displaySeconds !== 1 ? "s" : ""}`
        : `${minutes} minute${minutes !== 1 ? "s" : ""}`;

    return `Reminder set! I will remind you in ${timeLabel}: "${message}"`;
  },
};
