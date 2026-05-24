import type { Bot } from "grammy";
import { forwardUserMessage } from "@/bot/utils/forward";
import { findBlockedKeyword } from "@/bot/utils/keywords";
import {
  getAdminChatId,
  getMessageText,
  isAdminContext,
} from "@/bot/utils/message";
import { createVerificationUrl } from "@/bot/utils/verification";
import { isUserBanned, isUserVerified, putAdminMapping } from "@/db/kv";
import type { AdminMessageMapping } from "@/types";

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
      const verifyUrl = createVerificationUrl(env);
      await ctx.reply(
        "Please complete this verification before sending again.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Verify in Telegram", web_app: { url: verifyUrl } }],
            ],
          },
        },
      );
      return;
    }

    const adminChatId = getAdminChatId(env);
    const forwardedMessageIds = await forwardUserMessage(ctx, adminChatId);
    const mapping: AdminMessageMapping = {
      userChatId: String(message.chat.id),
      userId: user.id,
      sourceMessageId: message.message_id,
      createdAt: new Date().toISOString(),
    };

    await Promise.all(
      forwardedMessageIds.map((messageId) =>
        putAdminMapping(env, adminChatId, messageId, mapping),
      ),
    );

    await ctx.reply("Message delivered. The admin can reply here.");
  });
};
