import type { Bot, Context } from "grammy";
import { forwardUserMessage } from "@/bot/utils/forward";
import { findBlockedKeyword } from "@/bot/utils/keywords";
import {
  getAdminChatId,
  getMessageText,
  isAdminContext,
} from "@/bot/utils/message";
import { replyWithVerification } from "@/bot/utils/verification";
import { isUserBanned, isUserVerified } from "@/db/kv";

export const registerUserHandlers = (bot: Bot, env: Env): void => {
  bot.on("message", async (ctx) => {
    if (isAdminContext(env, ctx)) {
      return;
    }

    const message = ctx.message;
    const user = ctx.from;
    if (!message || !user || user.is_bot) {
      return;
    }

    if (await isUserBanned(env, user.id)) {
      return;
    }

    const text = getMessageText(message);
    if (text.startsWith("/")) {
      await ctx.reply("Unknown command. Send /help for commands.");
      return;
    }

    const blockedKeyword = await findBlockedKeyword(env, text);
    if (blockedKeyword) {
      console.warn({
        level: "warn",
        event: "message.keyword_blocked",
        worker_name: env.WORKER_NAME,
        user_id: user.id,
        chat_id: String(message.chat.id),
        keyword: blockedKeyword,
      });
      return;
    }

    if (!(await isUserVerified(env, user.id))) {
      await replyWithVerification(env, ctx);
      return;
    }

    const adminChatId = getAdminChatId(env);
    await forwardUserMessage(ctx, adminChatId);
    await reactToDeliveredMessage(env, ctx);
  });
};

const reactToDeliveredMessage = async (
  env: Env,
  ctx: Context,
): Promise<void> => {
  try {
    await ctx.react("👌");
  } catch (error) {
    console.warn({
      level: "warn",
      event: "message.delivery_reaction_failed",
      worker_name: env.WORKER_NAME,
      user_id: ctx.from?.id,
      chat_id: ctx.chat?.id ? String(ctx.chat.id) : undefined,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
