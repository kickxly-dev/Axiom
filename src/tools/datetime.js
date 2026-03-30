/**
 * Tool: datetime
 * Returns the current date and/or time in a requested timezone.
 */
export const datetimeTool = {
  name: "datetime",
  description:
    "Returns the current date and time. Optionally accepts a timezone (IANA format, e.g. 'America/New_York'). " +
    "Use this when the user asks what time it is or what today's date is.",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "IANA timezone string, e.g. 'America/New_York', 'Europe/London', 'UTC'. Defaults to UTC.",
      },
      format: {
        type: "string",
        enum: ["date", "time", "datetime"],
        description:
          "'date' for date only, 'time' for time only, 'datetime' for both. Defaults to 'datetime'.",
      },
    },
    required: [],
  },

  /**
   * Execute the tool.
   * @param {{ timezone?: string, format?: string }} params
   * @returns {string}
   */
  execute({ timezone = "UTC", format = "datetime" } = {}) {
    try {
      const now = new Date();
      const options = {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      };

      if (format === "date") {
        delete options.hour;
        delete options.minute;
        delete options.second;
        delete options.timeZoneName;
      } else if (format === "time") {
        delete options.weekday;
        delete options.year;
        delete options.month;
        delete options.day;
      }

      return now.toLocaleString("en-US", options);
    } catch (err) {
      return `Error getting datetime: ${err.message}`;
    }
  },
};
