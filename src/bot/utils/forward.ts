import type { Context } from "grammy";
import { appendUserReference, hasCaptionSlot } from "@/bot/utils/message";

export const forwardUserMessage = async (
  ctx: Context,
  adminChatId: string,
): Promise<number[]> => {
  const message = ctx.message;
  if (!message) return [];

  const sourceChatId = String(message.chat.id);
  if ("text" in message && typeof message.text === "string") {
    const sent = await ctx.api.sendMessage(
      adminChatId,
      appendUserReference(message.text, message),
      { parse_mode: "MarkdownV2" },
    );
    return [sent.message_id];
  }

  if (hasCaptionSlot(message)) {
    const caption =
      "caption" in message && typeof message.caption === "string"
        ? message.caption
        : "";
    const copied = await ctx.api.copyMessage(
      adminChatId,
      sourceChatId,
      message.message_id,
      {
        caption: appendUserReference(caption, message),
        parse_mode: "MarkdownV2",
      },
    );
    return [copied.message_id];
  }

  const copied = await ctx.api.copyMessage(
    adminChatId,
    sourceChatId,
    message.message_id,
  );
  const reference = await ctx.api.sendMessage(
    adminChatId,
    appendUserReference("", message),
    {
      parse_mode: "MarkdownV2",
      reply_parameters: {
        message_id: copied.message_id,
        allow_sending_without_reply: true,
      },
    },
  );
  return [copied.message_id, reference.message_id];
};
