import { verifyUser } from "@/db/kv";
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

    const { telegramInitData, turnstileResponse } =
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

    return {
      status: 200,
      body: { ok: true },
    };
  };
}
