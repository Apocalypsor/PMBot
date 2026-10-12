# PMBot

Telegram private-message relay bot running on Cloudflare Workers, Elysia, and grammY. It forwards user messages to an admin chat, tags each message with a user reference, and lets the admin reply back by replying to that reference.

## Features

- Telegram webhook endpoint at `/api/telegram/webhook/:secret`
- User to admin message relay with a `> from ... (user_id)` reference
- Admin reply to user by replying to the reference message
- Telegram Mini App + Turnstile verification gate for non-admin users
- Dynamic blocked keywords from admin commands
- KV-backed bot state, with a short Durable Object fallback for freshly verified users

## Requirements

- Bun 1.4.3 or later (CI uses the version pinned in `package.json`)
- Cloudflare account
- Telegram bot token from BotFather
- Cloudflare Turnstile site key and secret key
- Telegram Mini App domain configured in BotFather for the Worker URL

## Configure Cloudflare

Create the KV namespace:

```bash
bunx wrangler kv namespace create PMBOT_KV
```

Copy the returned namespace `id` into `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "PMBOT_KV",
    "id": "your-kv-id"
  }
]
```

Durable Object state for the short verification fallback is already declared in `wrangler.jsonc`. It is created by the migration during deploy; no separate create command is needed.

Set non-secret Worker vars in `wrangler.jsonc`:

```jsonc
"vars": {
  "WORKER_NAME": "pmbot"
}
```

Set secrets:

```bash
bunx wrangler secret put BOT_TOKEN
bunx wrangler secret put ADMIN_CHAT_ID
bunx wrangler secret put TURNSTILE_SITE_KEY
bunx wrangler secret put TURNSTILE_SECRET_KEY
bunx wrangler secret put PUBLIC_BASE_URL
bunx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

Turnstile uses two keys:

- `TURNSTILE_SITE_KEY`: rendered into the verification page as the widget `sitekey`.
- `TURNSTILE_SECRET_KEY`: sent only from the Worker to Cloudflare Siteverify.

## Install And Verify

```bash
bun install
bun run typegen
bun check
bun run lint
```

`bun check` runs Bun's native TypeScript checker using `tsconfig.json`.
`bun run typecheck` is an alias for the same check; `bun run lint` runs Biome.

## Run Locally

```bash
bun run dev
```

Telegram webhooks and Mini App verification require a public HTTPS URL. For local testing, use a tunnel and set `PUBLIC_BASE_URL` to the public tunnel URL.

## Deploy

```bash
bun run deploy
```

GitHub Actions deploys require these repository secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Worker runtime secrets such as `BOT_TOKEN` and `TURNSTILE_SECRET_KEY` are stored in Cloudflare via `wrangler secret put`; the current GitHub workflow does not read them from GitHub.

After deploy, configure the Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "content-type: application/json" \
  -d '{
    "url": "https://pmbot.example.com/api/telegram/webhook/'"$TELEGRAM_WEBHOOK_SECRET"'"
  }'
```

Replace `https://pmbot.example.com` with your Worker URL.
The Worker requires the webhook secret as a path segment and silently ignores updates when it does not match `TELEGRAM_WEBHOOK_SECRET`.

## Admin Commands

Send these commands to the bot from the admin chat:

```text
/banword keyword
/unbanword keyword
/banwords
/banuser user_id
/unbanuser user_id
/help
```

Reply to the `> from ... (user_id)` reference message in the admin chat to send your response back to that user. For media that can carry captions, the reference is appended to the copied message. For messages that cannot carry captions, the bot sends a separate reference message; reply to that reference.
