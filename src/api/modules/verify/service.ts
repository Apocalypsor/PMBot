import { sendMessage } from "@/clients/telegram";
import { completeVerification, getVerifyTokenRecord } from "@/db/kv";
import { reportError } from "@/observability";
import type { VerifyHtmlResult } from "./types";
import {
  getFormString,
  renderStatusPage,
  renderVerifyForm,
  verifyTelegramMiniAppInitData,
  verifyTurnstile,
} from "./utils";

export abstract class VerifyService {
  static renderPage = async (
    env: Env,
    token: string,
  ): Promise<VerifyHtmlResult> => {
    if (!token) {
      return {
        status: 400,
        html: renderStatusPage("Invalid verification link.", false),
      };
    }

    const record = await getVerifyTokenRecord(env, token);
    if (!record) {
      return {
        status: 400,
        html: renderStatusPage("This verification link has expired.", false),
      };
    }

    if (!env.TURNSTILE_SITE_KEY) {
      return {
        status: 500,
        html: renderStatusPage("Turnstile site key is not configured.", false),
      };
    }

    return {
      status: 200,
      html: renderVerifyForm(token, env.TURNSTILE_SITE_KEY),
    };
  };

  static submit = async (
    env: Env,
    request: Request,
    waitUntil: ExecutionContext["waitUntil"],
  ): Promise<VerifyHtmlResult> => {
    const form = await request.formData();
    const token = getFormString(form.get("token"));
    const turnstileResponse = getFormString(form.get("cf-turnstile-response"));
    const telegramInitData = getFormString(form.get("telegram_init_data"));

    if (!token || !turnstileResponse || !telegramInitData) {
      return {
        status: 400,
        html: renderStatusPage("Verification response is missing.", false),
      };
    }

    const record = await getVerifyTokenRecord(env, token);
    if (!record) {
      return {
        status: 400,
        html: renderStatusPage("This verification link has expired.", false),
      };
    }

    const telegramUser = await verifyTelegramMiniAppInitData(
      env.BOT_TOKEN,
      telegramInitData,
    );
    if (!telegramUser || telegramUser.id !== record.userId) {
      return {
        status: 401,
        html: renderStatusPage("Open this verification from Telegram.", false),
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
        html: renderStatusPage("Verification failed. Try again.", false),
      };
    }

    await completeVerification(env, token, record);
    waitUntil(
      sendMessage(
        env,
        record.chatId,
        "Verification complete. Please send your message again.",
      ).catch((error: unknown) => {
        reportError(env, "telegram.verify_success_message_failed", error, {
          user_id: record.userId,
          chat_id: record.chatId,
        });
      }),
    );

    return {
      status: 200,
      html: renderStatusPage("Verification complete.", true),
    };
  };
}
