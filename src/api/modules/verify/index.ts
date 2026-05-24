import { Elysia, t } from "elysia";
import { cf } from "@/api/plugins/cf";
import { VerifyService } from "./service";
import { htmlResponse } from "./utils";

export const verifyController = new Elysia({ name: "controller.verify" })
  .use(cf)
  .get(
    "/verify",
    async ({ env, query }) => {
      const result = await VerifyService.renderPage(env, query.token ?? "");
      return htmlResponse(result.html, result.status);
    },
    {
      query: t.Object({ token: t.Optional(t.String()) }),
    },
  )
  .post("/verify", async ({ env, request, waitUntil }) => {
    const result = await VerifyService.submit(env, request, waitUntil);
    return htmlResponse(result.html, result.status);
  });
