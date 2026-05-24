import type { Context } from "grammy";
import type { Message } from "grammy/types";
import { getMessageText } from "@/bot/utils/message";

export const getCommandArgument = (ctx: Context): string => {
  const text = ctx.message ? getMessageText(ctx.message) : "";
  const firstSpace = text.indexOf(" ");
  return firstSpace === -1 ? "" : text.slice(firstSpace + 1).trim();
};

export const getReplyToMessage = (message: Message): Message | undefined => {
  if ("reply_to_message" in message) {
    return message.reply_to_message;
  }
  return undefined;
};

export const formatBannedKeywords = (words: string[]): string => {
  return words.length > 0
    ? `Blocked keywords:\n${words.map((word) => `- ${word}`).join("\n")}`
    : "No blocked keywords are configured.";
};
