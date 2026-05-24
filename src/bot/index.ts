import { Api, Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { registerAdminHandlers } from "@/bot/handlers/admin";
import { registerStartHandlers } from "@/bot/handlers/start";
import { registerUserHandlers } from "@/bot/handlers/user";
import { memoizeAsync } from "@/bot/utils/memoize";
import { getCachedBotInfo, putCachedBotInfo } from "@/db/kv";
import { reportError } from "@/observability";

export const createBot = (env: Env, botInfo: UserFromGetMe): Bot => {
  const bot = new Bot(env.BOT_TOKEN, { botInfo });

  bot.catch(async (error) => {
    await reportError(env, "bot.handler_error", error.error).catch(() => {});
  });

  registerStartHandlers(bot, env);
  registerAdminHandlers(bot, env);
  registerUserHandlers(bot, env);

  return bot;
};

export const getBotInfo = memoizeAsync(
  async (env: Env): Promise<UserFromGetMe> => {
    const cached = await getCachedBotInfo(env);
    if (cached) return JSON.parse(cached) as UserFromGetMe;

    const api = new Api(env.BOT_TOKEN);
    const botInfo = await api.getMe();
    await putCachedBotInfo(env, JSON.stringify(botInfo));
    return botInfo;
  },
);

export const processTelegramUpdate = async (
  env: Env,
  update: Update,
): Promise<void> => {
  const bot = createBot(env, await getBotInfo(env));
  await bot.handleUpdate(update);
};
