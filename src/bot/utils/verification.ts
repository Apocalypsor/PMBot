import type { Context } from "grammy";

export const createVerificationUrl = (
  env: Env,
  promptMessageId?: number,
): string => {
  const url = new URL("/verify", `${env.PUBLIC_BASE_URL.replace(/\/+$/, "")}/`);
  if (promptMessageId) {
    url.searchParams.set("message_id", String(promptMessageId));
  }
  return url.toString();
};

export const replyWithVerification = async (
  env: Env,
  ctx: Context,
): Promise<void> => {
  const sent = await ctx.reply(
    "Please complete this verification before sending again.",
    {
      reply_markup: createVerificationKeyboard(env),
    },
  );

  await ctx.api
    .editMessageReplyMarkup(sent.chat.id, sent.message_id, {
      reply_markup: createVerificationKeyboard(env, sent.message_id),
    })
    .catch((error: unknown) => {
      console.warn({
        level: "warn",
        event: "verification.prompt_markup_update_failed",
        worker_name: env.WORKER_NAME,
        chat_id: String(sent.chat.id),
        message_id: sent.message_id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
};

const createVerificationKeyboard = (env: Env, promptMessageId?: number) => {
  return {
    inline_keyboard: [
      [
        {
          text: "Verify in Telegram",
          web_app: { url: createVerificationUrl(env, promptMessageId) },
        },
      ],
    ],
  };
};
