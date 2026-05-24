import { Api } from "grammy";
import type { BotCommand } from "grammy/types";
import { memoizeAsync } from "@/bot/utils/memoize";
import { getBotCommandsVersion, putBotCommandsVersion } from "@/db/kv";

const BOT_COMMANDS_VERSION = 1;

const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Show commands" },
];

export const helpText = (isAdmin: boolean): string => {
  const lines = [
    "Commands:",
    "/start - start the bot",
    "/help - show this help",
  ];

  if (isAdmin) {
    lines.push(
      "",
      "Admin commands:",
      "/banword keyword - block a keyword",
      "/unbanword keyword - remove a dynamic keyword",
      "/banwords - list blocked keywords",
      "/banuser [user_id] - ban a user, or reply to a forwarded user message",
      "/unbanuser user_id - unban a user",
      "",
      "Reply to any forwarded user message to send your response back.",
    );
  } else {
    lines.push("", "Send a message here and it will be forwarded.");
  }

  return lines.join("\n");
};

export const syncBotCommands = memoizeAsync(async (env: Env): Promise<void> => {
  const cached = await getBotCommandsVersion(env);
  if (cached === String(BOT_COMMANDS_VERSION)) {
    return;
  }

  const api = new Api(env.BOT_TOKEN);
  await api.setMyCommands(BOT_COMMANDS);
  await putBotCommandsVersion(env, String(BOT_COMMANDS_VERSION));
});
