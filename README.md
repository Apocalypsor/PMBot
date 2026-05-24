# PMBot

Telegram private-message relay bot running on Cloudflare Workers, Elysia, and grammY. It forwards user messages to an admin chat, maps the copied admin message back to the user, and copies admin replies back to the original user.

## Features

- Telegram webhook endpoint at `/api/telegram/webhook/:secret`
- User to admin message copy with reply mapping
- Admin reply to user by replying to the copied message
- Telegram Mini App + Turnstile verification gate for non-admin users
- Dynamic blocked keywords from admin commands
- KV-backed verification state and message mappings

## Requirements

- Bun
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

For local development, copy `.dev.vars.example` to `.dev.vars` and fill in the values.

## Install And Verify

```bash
bun install
bun run typegen
bun run typecheck
bun run check
```

## Run Locally

```bash
bun run dev
```

Telegram webhooks and Mini App verification require a public HTTPS URL. For local testing, use a tunnel and set `PUBLIC_BASE_URL` to the public tunnel URL.

## Deploy

```bash
bun run deploy
```

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

Reply to any copied user message in the admin chat to send your response back to that user.

## Code Quality

- `bun run check` runs Biome in check mode.
- `bun run fix` applies Biome fixes.
- Husky `pre-commit` runs `bun typecheck` and `bun lint-staged`.
- `lint-staged` runs Biome on staged files.
