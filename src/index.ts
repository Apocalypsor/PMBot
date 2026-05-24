import { app } from "@/api";
import type { RequestWithCtx } from "@/api/plugins/cf";
import type { Env } from "@/types";

export default {
  /**
   * Keep the Worker entrypoint thin. Elysia reads env from the
   * `cloudflare:workers` global, and per-request ExecutionContext is attached
   * here for the cf plugin.
   */
  fetch: (
    request: Request,
    _env: Env,
    ctx: ExecutionContext,
  ): Response | Promise<Response> => {
    (request as RequestWithCtx)._ctx = ctx;
    return app.handle(request);
  },
};
