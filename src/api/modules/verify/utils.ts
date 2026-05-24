import type { TelegramMiniAppUser, TurnstileSiteVerifyResponse } from "./types";

const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 15 * 60;

export const htmlResponse = (body: string, status = 200): Response => {
  return new Response(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
};

export const renderVerifyForm = (siteKey: string): string => {
  return htmlShell(
    "Verify",
    `
      <script src="https://telegram.org/js/telegram-web-app.js"></script>
      <script>
        const telegram = window.Telegram?.WebApp;
        let submitting = false;

        if (telegram?.initData) {
          telegram.ready();
        } else if (telegram?.showAlert) {
          telegram.showAlert("Open this verification from Telegram.");
        }

        const closeTelegram = () => {
          if (telegram?.close) telegram.close();
        };

        const finishVerification = () => {
          if (telegram?.showAlert) {
            telegram.showAlert(
              "Verification complete. Please send your message again.",
              closeTelegram,
            );
            return;
          }

          closeTelegram();
        };

        const showFailure = () => {
          if (telegram?.showAlert) {
            telegram.showAlert("Verification failed. Try again.");
          }
        };

        window.onTurnstileSuccess = async (token) => {
          if (submitting) return;
          submitting = true;

          try {
            const response = await fetch("/verify", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-telegram-init-data": telegram?.initData || "",
              },
              body: JSON.stringify({ turnstileToken: token }),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.ok !== true) {
              throw new Error("verification_failed");
            }

            finishVerification();
          } catch {
            submitting = false;
            window.turnstile?.reset();
            showFailure();
          }
        };

        window.onTurnstileExpired = () => {
          submitting = false;
        };
      </script>
      <div
        class="cf-turnstile"
        data-sitekey="${escapeHtml(siteKey)}"
        data-theme="dark"
        data-callback="onTurnstileSuccess"
        data-expired-callback="onTurnstileExpired"
        data-error-callback="onTurnstileExpired"
      ></div>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    `,
  );
};

export const renderStatusPage = (
  message: string,
  success: boolean,
  autoClose = false,
): string => {
  return htmlShell(
    success ? "Done" : "Error",
    `
      <p>${escapeHtml(message)}</p>
      ${
        autoClose
          ? `
            <p class="muted">Closing...</p>
            <script src="https://telegram.org/js/telegram-web-app.js"></script>
            <script>
              const telegram = window.Telegram?.WebApp;
              if (telegram) {
                telegram.ready();
                setTimeout(() => telegram.close(), 500);
              }
            </script>
          `
          : ""
      }
    `,
  );
};

export const getFormString = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

export const getVerifySubmitPayload = async (
  request: Request,
): Promise<{
  telegramInitData: string;
  turnstileResponse: string;
}> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return {
      telegramInitData:
        request.headers.get("x-telegram-init-data") ??
        getBodyString(body.telegramInitData) ??
        getBodyString(body.telegram_init_data) ??
        "",
      turnstileResponse:
        getBodyString(body.turnstileToken) ??
        getBodyString(body.cfTurnstileResponse) ??
        getBodyString(body["cf-turnstile-response"]) ??
        "",
    };
  }

  const form = await request.formData();
  return {
    telegramInitData: getFormString(form.get("telegram_init_data")),
    turnstileResponse: getFormString(form.get("cf-turnstile-response")),
  };
};

export const verifyTurnstile = async (
  env: Env,
  response: string,
  remoteIp?: string,
): Promise<TurnstileSiteVerifyResponse> => {
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", response);
  if (remoteIp) {
    body.append("remoteip", remoteIp);
  }

  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body,
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!result.ok) {
    return { success: false, "error-codes": [`http-${result.status}`] };
  }

  return result.json() as Promise<TurnstileSiteVerifyResponse>;
};

export const verifyTelegramMiniAppInitData = async (
  botToken: string,
  initData: string,
  maxAgeSeconds = TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
): Promise<TelegramMiniAppUser | null> => {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return null;
  }
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    botToken,
  );
  const signature = await hmacSha256(secretKey, dataCheckString);
  if (!timingSafeEqual(bytesToHex(signature), hash)) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (
    !Number.isFinite(authDate) ||
    Date.now() / 1000 - authDate > maxAgeSeconds
  ) {
    return null;
  }

  const userJson = params.get("user");
  if (!userJson) {
    return null;
  }

  try {
    const user = JSON.parse(userJson) as TelegramMiniAppUser;
    return typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
};

const htmlShell = (title: string, content: string): string => {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        background: #000;
        color: #f4f4f5;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
      }
      main {
        box-sizing: border-box;
        max-width: 420px;
        padding: 16px;
        width: 100%;
      }
      h1 {
        font-size: 20px;
        line-height: 1.2;
        margin: 0 0 12px;
        text-align: center;
      }
      p {
        color: #d4d4d8;
        line-height: 1.5;
        margin: 0;
      }
      .cf-turnstile {
        display: flex;
        justify-content: center;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      ${content}
    </main>
  </body>
</html>`;
};

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

const getBodyString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const hmacSha256 = async (
  keyBytes: Uint8Array | ArrayBuffer,
  data: string,
): Promise<Uint8Array> => {
  const keyBuffer: ArrayBuffer =
    keyBytes instanceof ArrayBuffer
      ? keyBytes
      : (keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength,
        ) as ArrayBuffer);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(signature);
};

const bytesToHex = (bytes: Uint8Array): string => {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const timingSafeEqual = (actual: string, expected: string): boolean => {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);

  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    diff |= actualBytes[index] ^ expectedBytes[index];
  }
  return diff === 0;
};
