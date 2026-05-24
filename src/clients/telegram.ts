import { Api } from "grammy";

export const createTelegramApi = (env: Env): Api => {
  return new Api(env.BOT_TOKEN);
};

export const sendMessage = async (
  env: Env,
  chatId: string,
  text: string,
): Promise<void> => {
  const api = createTelegramApi(env);
  await api.sendMessage(chatId, text);
};
