import type { Context } from "grammy";
import type { Message } from "grammy/types";

export const getAdminChatId = (env: Env): string => {
  return env.ADMIN_CHAT_ID.trim();
};

export const isAdminContext = (env: Env, ctx: Context): boolean => {
  const adminChatId = getAdminChatId(env);
  return (
    String(ctx.chat?.id ?? "") === adminChatId ||
    String(ctx.from?.id ?? "") === adminChatId
  );
};

export const getMessageText = (message: Message): string => {
  if ("text" in message && typeof message.text === "string") {
    return message.text;
  }
  if ("caption" in message && typeof message.caption === "string") {
    return message.caption;
  }
  return "";
};

export const appendUserReference = (text: string, message: Message): string => {
  const escapedText = escapeMarkdownV2(text);
  const reference = formatUserReference(message);
  return escapedText ? `${escapedText}\n\n${reference}` : reference;
};

export const formatUserReference = (message: Message): string => {
  const user = message.from;
  const username = user?.username
    ? `@${user.username}`
    : [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
      "unknown";
  const userId = user?.id ?? "unknown";

  return `> ${escapeMarkdownV2(`from ${username} (${userId})`)}`;
};

export const getReferencedUserId = (message: Message): number | null => {
  const text = getMessageText(message);
  const match = /(?:^|\n)\s*>?\s*from\s+.+\((\d+)\)\s*$/i.exec(text);
  if (!match) return null;

  const userId = Number(match[1]);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
};

export const hasCaptionSlot = (message: Message): boolean => {
  return (
    "animation" in message ||
    "audio" in message ||
    "document" in message ||
    "paid_media" in message ||
    "photo" in message ||
    "video" in message ||
    "voice" in message
  );
};

const escapeMarkdownV2 = (value: string): string => {
  return value.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
};
