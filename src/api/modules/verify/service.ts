import { createTelegramApi } from "@/clients/telegram";
import { verifyUser } from "@/db/kv";
import { reportError } from "@/observability";
import type { VerifyHtmlResult, VerifySubmitResult } from "./types";
import {
  getVerifySubmitPayload,
  renderStatusPage,
  renderVerifyForm,
  verifyTelegramMiniAppInitData,
  verifyTurnstile,
} from "./utils";

export abstract class VerifyService {
  static renderPage = async (env: Env): Promise<VerifyHtmlResult> => {
    if (!env.TURNSTILE_SITE_KEY) {
      return {
        status: 500,
        html: renderStatusPage("Turnstile site key is not configured.", false),
      };
    }

    return {
      status: 200,
      html: renderVerifyForm(env.TURNSTILE_SITE_KEY),
    };
  };

  static submit = async (
    env: Env,
    request: Request,
  ): Promise<VerifySubmitResult> => {
    if (!env.TURNSTILE_SECRET_KEY) {
      return {
        status: 500,
        body: { ok: false, error: "turnstile_secret_missing" },
      };
    }

    const { promptMessageId, telegramInitData, turnstileResponse } =
      await getVerifySubmitPayload(request);

    if (!turnstileResponse || !telegramInitData) {
      return {
        status: 400,
        body: { ok: false, error: "verification_response_missing" },
      };
    }

    const telegramUser = await verifyTelegramMiniAppInitData(
      env.BOT_TOKEN,
      telegramInitData,
    );
    if (!telegramUser) {
      return {
        status: 401,
        body: { ok: false, error: "telegram_init_data_invalid" },
      };
    }

    const verification = await verifyTurnstile(
      env,
      turnstileResponse,
      request.headers.get("CF-Connecting-IP") ?? undefined,
    );
    if (!verification.success) {
      return {
        status: 400,
        body: { ok: false, error: "turnstile_failed" },
      };
    }

    await verifyUser(env, telegramUser.id);
    await notifyVerificationComplete(env, telegramUser.id, promptMessageId);

    return {
      status: 200,
      body: { ok: true },
    };
  };
}

const notifyVerificationComplete = async (
  env: Env,
  userId: number,
  promptMessageId?: number,
): Promise<void> => {
  const api = createTelegramApi(env);

  if (promptMessageId) {
    await api.deleteMessage(userId, promptMessageId).catch(async (error) => {
      await reportError(env, "telegram.verify_prompt_delete_failed", error, {
        prompt_message_id: promptMessageId,
        user_id: userId,
      });
    });
  }

  await api
    .sendMessage(userId, "Verification complete. You can send messages now.")
    .catch(async (error) => {
      await reportError(env, "telegram.verify_complete_message_failed", error, {
        user_id: userId,
      });
    });
};
