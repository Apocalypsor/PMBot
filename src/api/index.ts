import { env as cfEnv } from "cloudflare:workers";
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { telegramController } from "@/api/modules/telegram";
import { verifyController } from "@/api/modules/verify";
import { reportError } from "@/observability";

export const app = new Elysia({
  adapter: CloudflareAdapter,
  name: "pmbot",
})
  .onError(async ({ code, error, request, status }) => {
    if (code === "VALIDATION" || code === "PARSE" || code === "NOT_FOUND") {
      return error;
    }

    await reportError(cfEnv, "http.unhandled_error", error, {
      method: request.method,
      pathname: new URL(request.url).pathname,
    });
    return status(500, { ok: false, error: "Internal Server Error" });
  })
  .get("/", () => ({
    ok: true,
    service: cfEnv.WORKER_NAME,
    webhook: "/api/telegram/webhook/:secret",
    verify: "/verify",
  }))
  .use(telegramController)
  .use(verifyController)
  .compile();

export type App = typeof app;
