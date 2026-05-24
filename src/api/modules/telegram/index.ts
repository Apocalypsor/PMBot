import { Elysia } from "elysia";
import { cf } from "@/api/plugins/cf";
import { syncBotCommands } from "@/bot/commands";
import { WebhookBody, WebhookParams } from "./model";
import { TelegramService } from "./service";

export const telegramController = new Elysia({ name: "controller.telegram" })
  .use(cf)
  .post(
    "/api/telegram/webhook/:secret",
    ({ body, env, params, waitUntil }) => {
      waitUntil(syncBotCommands(env).catch(() => {}));
      waitUntil(TelegramService.handleWebhook(env, body, params.secret));
      return { ok: true };
    },
    {
      body: WebhookBody,
      params: WebhookParams,
    },
  );
