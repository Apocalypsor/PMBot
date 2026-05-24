import type { Context } from "grammy";
import { appendUserReference, hasCaptionSlot } from "@/bot/utils/message";

export const forwardUserMessage = async (
  ctx: Context,
  adminChatId: string,
): Promise<void> => {
  const message = ctx.message;
  if (!message) return;

  const sourceChatId = String(message.chat.id);
  if ("text" in message && typeof message.text === "string") {
    await ctx.api.sendMessage(
      adminChatId,
      appendUserReference(message.text, message),
      {
        parse_mode: "MarkdownV2",
      },
    );
    return;
  }

  if (hasCaptionSlot(message)) {
    const caption =
      "caption" in message && typeof message.caption === "string"
        ? message.caption
        : "";
    await ctx.api.copyMessage(adminChatId, sourceChatId, message.message_id, {
      caption: appendUserReference(caption, message),
      parse_mode: "MarkdownV2",
    });
    return;
  }

  const copied = await ctx.api.copyMessage(
    adminChatId,
    sourceChatId,
    message.message_id,
  );
  await ctx.api.sendMessage(adminChatId, appendUserReference("", message), {
    parse_mode: "MarkdownV2",
    reply_parameters: {
      message_id: copied.message_id,
      allow_sending_without_reply: true,
    },
  });
};
