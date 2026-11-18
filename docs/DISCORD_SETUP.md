# Discord Feedback Setup

The feedback system in this application sends user feedback to a Discord channel via webhooks. To set this up:

## 1. Create a Discord Webhook

1. Open your Discord server
2. Go to **Server Settings** (right-click the server name)
3. Navigate to **Integrations** > **Webhooks**
4. Click **Create Webhook**
5. Choose the channel where you want feedback to appear
6. Copy the **Webhook URL**

## 2. Store the webhook as a Worker secret

The feedback endpoint is the `/api/feedback` Worker (`worker/index.ts`). Store the URL as a secret on that Worker, never in the static build or a `PUBLIC_` variable:

```bash
yarn wrangler secret put DISCORD_WEBHOOK_URL
```

See `docs/FEEDBACK_SETUP.md` for the other destinations and the rate limit.

## Testing

The Worker's tests use stubbed destinations and need no real webhook:

```bash
yarn test tests/feedback-function.test.ts
```

Then submit feedback from the deployed site's feedback dialog.

## Troubleshooting

- **"Feedback system not configured"** error: Make sure the `DISCORD_WEBHOOK_URL` environment variable is set
- **Webhook not working**: Verify the Discord webhook URL is correct and the bot has permissions to post in the channel
- **Tests failing**: Ensure you have a test Discord webhook set up or mock the environment variable in tests

## Security Note

- Never commit the webhook URL or put it in `.env.example`
- The webhook URL contains sensitive tokens that should be kept private
- Consider using different webhooks for development and production environments
