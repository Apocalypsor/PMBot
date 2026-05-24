import type { Context } from "grammy";

export const createVerificationUrl = (env: Env): string => {
  const baseUrl = env.PUBLIC_BASE_URL.replace(/\/+$/, "");
  return `${baseUrl}/verify`;
};

export const replyWithVerification = async (
  env: Env,
  ctx: Context,
): Promise<void> => {
  await ctx.reply("Please complete this verification before sending again.", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Verify in Telegram",
            web_app: { url: createVerificationUrl(env) },
          },
        ],
      ],
    },
  });
};
