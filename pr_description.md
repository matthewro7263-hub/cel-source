🧪 Add tests for discord notification logic

🎯 **What:** This adds missing unit tests for the `notifyDiscord` functionality in `server/discord.ts`.
📊 **Coverage:** Covered 7 edge cases and happy path scenarios, including:
  * Graceful skip when project is not found.
  * Graceful skip when Discord webhook URL is missing, malformed, or using an unsupported protocol.
  * Successful fetch payload verification, including checking parsed discord hex color code formatting.
  * Ensuring descriptions longer than 4000 characters are correctly truncated so they don't break the Discord API limits.
✨ **Result:** Enhanced test coverage ensures our Discord notification payloads strictly conform to requirements and the system handles absent/malformed configs without breaking.
