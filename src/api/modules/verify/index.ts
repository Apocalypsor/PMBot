import { Elysia } from "elysia";
import { cf } from "@/api/plugins/cf";
import { VerifyService } from "./service";
import { htmlResponse } from "./utils";

export const verifyController = new Elysia({ name: "controller.verify" })
  .use(cf)
  .get("/verify", async ({ env }) => {
    const result = await VerifyService.renderPage(env);
    return htmlResponse(result.html, result.status);
  })
  .post("/verify", async ({ env, request }) => {
    const result = await VerifyService.submit(env, request);
    return Response.json(result.body, {
      status: result.status,
      headers: { "cache-control": "no-store" },
    });
  });
