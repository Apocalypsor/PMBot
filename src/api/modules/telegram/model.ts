import { t } from "elysia";

export const WebhookBody = t.Unknown();

export const WebhookParams = t.Object({
  secret: t.String({ minLength: 1 }),
});
