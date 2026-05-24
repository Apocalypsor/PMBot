import type { Update } from "grammy/types";
import { processTelegramUpdate } from "@/bot";
import { reportError } from "@/observability";
import { isAuthorizedTelegramWebhook } from "./utils";

export abstract class TelegramService {
  static handleWebhook = async (
    env: Env,
    body: unknown,
    webhookSecret: string,
  ): Promise<void> => {
    const authorized = isAuthorizedTelegramWebhook(env, webhookSecret);
    if (!authorized) {
      return;
    }

    try {
      await processTelegramUpdate(env, body as Update);
    } catch (error) {
      await reportError(env, "telegram.webhook_process_failed", error);
    }
  };
}
