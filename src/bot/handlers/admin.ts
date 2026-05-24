import type { Bot, Context } from "grammy";
import {
  formatBannedKeywords,
  getCommandArgument,
  getReplyToMessageId,
} from "@/bot/utils/admin";
import {
  addDynamicBannedKeyword,
  getAllBannedKeywords,
  normalizeKeyword,
  removeDynamicBannedKeyword,
} from "@/bot/utils/keywords";
import {
  getAdminChatId,
  getMessageText,
  isAdminContext,
} from "@/bot/utils/message";
import { banUser, getAdminMapping, unbanUser } from "@/db/kv";
import { reportError } from "@/observability";

export const registerAdminHandlers = (bot: Bot, env: Env): void => {
  const admin = bot.filter((ctx) => isAdminContext(env, ctx));

  admin.command("banwords", async (ctx) => {
    await ctx.reply(formatBannedKeywords(await getAllBannedKeywords(env)));
  });

  admin.command("banword", async (ctx) => {
    const keyword = normalizeKeyword(getCommandArgument(ctx));
    if (!keyword) {
      await ctx.reply("Usage: /banword keyword");
      return;
    }

    await addDynamicBannedKeyword(env, keyword);
    await ctx.reply(`Blocked keyword: ${keyword}`);
  });

  admin.command("unbanword", async (ctx) => {
    const keyword = normalizeKeyword(getCommandArgument(ctx));
    if (!keyword) {
      await ctx.reply("Usage: /unbanword keyword");
      return;
    }

    await removeDynamicBannedKeyword(env, keyword);
    await ctx.reply(`Unblocked keyword: ${keyword}`);
  });

  admin.command("banuser", async (ctx) => {
    const userId = await resolveTargetUserId(env, ctx);
    if (!userId) {
      await ctx.reply(
        "Usage: /banuser user_id, or reply /banuser to a forwarded user message.",
      );
      return;
    }

    await banUser(env, userId);
    await ctx.reply(`Banned user: ${userId}`);
  });

  admin.command("unbanuser", async (ctx) => {
    const userId = Number(getCommandArgument(ctx));
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      await ctx.reply("Usage: /unbanuser user_id");
      return;
    }

    await unbanUser(env, userId);
    await ctx.reply(`Unbanned user: ${userId}`);
  });

  admin.on("message", async (ctx) => {
    const message = ctx.message;
    if (!message) return;

    const text = getMessageText(message);
    if (text.startsWith("/")) {
      await ctx.reply("Unknown admin command. Send /help for commands.");
      return;
    }

    const replyToMessageId = getReplyToMessageId(message);
    if (!replyToMessageId) {
      await ctx.reply(
        "Reply to a copied user message to send your response back.",
      );
      return;
    }

    const adminChatId = String(message.chat.id);
    const mapping =
      (await getAdminMapping(env, adminChatId, replyToMessageId)) ??
      (await getAdminMapping(env, getAdminChatId(env), replyToMessageId));

    if (!mapping) {
      await ctx.reply("No user mapping was found for that replied message.");
      return;
    }

    try {
      await ctx.api.copyMessage(
        mapping.userChatId,
        adminChatId,
        message.message_id,
      );
      await reactToDeliveredMessage(env, ctx);
    } catch (error) {
      await reportError(env, "telegram.admin_reply_failed", error, {
        user_id: mapping.userId,
        user_chat_id: mapping.userChatId,
        admin_message_id: message.message_id,
      });
      await ctx.reply("Failed to send this reply.");
    }
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
      event: "admin.reply_reaction_failed",
      worker_name: env.WORKER_NAME,
      user_id: ctx.from?.id,
      chat_id: ctx.chat?.id ? String(ctx.chat.id) : undefined,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const resolveTargetUserId = async (
  env: Env,
  ctx: Context,
): Promise<number | null> => {
  const argument = Number(getCommandArgument(ctx));
  if (Number.isSafeInteger(argument) && argument > 0) {
    return argument;
  }

  const message = ctx.message;
  if (!message) return null;

  const replyToMessageId = getReplyToMessageId(message);
  if (!replyToMessageId) return null;

  const adminChatId = String(message.chat.id);
  const mapping =
    (await getAdminMapping(env, adminChatId, replyToMessageId)) ??
    (await getAdminMapping(env, getAdminChatId(env), replyToMessageId));

  return mapping?.userId ?? null;
};
