import type { Bot } from "grammy";
import { helpText } from "@/bot/commands";
import { isAdminContext } from "@/bot/utils/message";

export const registerStartHandlers = (bot: Bot, env: Env): void => {
  bot.command("start", async (ctx) => {
    if (isAdminContext(env, ctx)) {
      await ctx.reply("Send /help to view available commands.");
      return;
    }

    await ctx.reply(
      "Send a message here and it will be forwarded to the admin.",
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(helpText(isAdminContext(env, ctx)));
  });
};
