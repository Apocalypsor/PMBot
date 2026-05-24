import { env as cfEnv } from "cloudflare:workers";
import { Elysia } from "elysia";
import type { Env } from "@/types";

export type RequestWithCtx = Request & { _ctx?: ExecutionContext };

const env = cfEnv as Env;

export const cf = new Elysia({ name: "cf" })
  .decorate("env", env)
  .derive({ as: "scoped" }, ({ request }) => {
    const ctx = (request as RequestWithCtx)._ctx;
    if (!ctx) {
      throw new Error("ExecutionContext not injected");
    }

    return {
      executionCtx: ctx,
      waitUntil: ctx.waitUntil.bind(ctx),
    };
  });
