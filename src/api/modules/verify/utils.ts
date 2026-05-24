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

export const renderVerifyForm = (token: string, siteKey: string): string => {
  return htmlShell(
    "Verify",
    `
      <p id="telegram-status">Preparing Telegram verification...</p>
      <form method="post" action="/verify" id="verify-form">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <input type="hidden" name="telegram_init_data" id="telegram-init-data">
        <div class="cf-turnstile" data-sitekey="${escapeHtml(siteKey)}"></div>
        <button type="submit" id="verify-button" disabled>Verify</button>
      </form>
      <script src="https://telegram.org/js/telegram-web-app.js"></script>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      <script>
        const telegram = window.Telegram?.WebApp;
        const status = document.getElementById("telegram-status");
        const initData = document.getElementById("telegram-init-data");
        const button = document.getElementById("verify-button");

        if (telegram?.initData) {
          telegram.ready();
          telegram.expand();
          initData.value = telegram.initData;
          button.disabled = false;
          status.textContent = "Complete the challenge below.";
        } else {
          status.textContent = "Open this verification from Telegram.";
        }
      </script>
    `,
  );
};

export const renderStatusPage = (message: string, success: boolean): string => {
  return htmlShell(success ? "Done" : "Error", `<p>${escapeHtml(message)}</p>`);
};

export const getFormString = (value: unknown): string => {
  return typeof value === "string" ? value : "";
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
        align-items: center;
        background: #f6f7f9;
        color: #15181e;
        display: flex;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
      }
      main {
        background: white;
        border: 1px solid #dde2ea;
        border-radius: 8px;
        box-shadow: 0 14px 50px rgb(21 24 30 / 10%);
        box-sizing: border-box;
        max-width: 420px;
        padding: 24px;
        width: calc(100% - 32px);
      }
      h1 {
        font-size: 22px;
        line-height: 1.2;
        margin: 0 0 16px;
      }
      p {
        line-height: 1.5;
        margin: 0;
      }
      button {
        background: #116149;
        border: 0;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font: inherit;
        font-weight: 650;
        margin-top: 18px;
        padding: 11px 14px;
        width: 100%;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
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
