# Discord Feedback Setup

The feedback system in this application sends user feedback to a Discord channel via webhooks. To set this up:

## 1. Create a Discord Webhook

1. Open your Discord server
2. Go to **Server Settings** (right-click the server name)
3. Navigate to **Integrations** > **Webhooks**
4. Click **Create Webhook**
5. Choose the channel where you want feedback to appear
6. Copy the **Webhook URL**

## 2. Configure Environment Variables

Create a `.env.local` file in the root of your project (it will be gitignored):

```bash
NEXT_PUBLIC_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

Replace `YOUR_WEBHOOK_ID` and `YOUR_WEBHOOK_TOKEN` with the values from your Discord webhook URL.

## 3. Restart Your Development Server

After adding the environment variable, restart your development server:

```bash
yarn dev
```

## Testing

You can test the feedback system by:

1. Running the feedback tests:
   ```bash
   yarn test feedback.test.ts
   ```

2. Using the feedback widget in the application UI

## Troubleshooting

- **"Feedback system not configured"** error: Make sure the `NEXT_PUBLIC_DISCORD_WEBHOOK_URL` environment variable is set
- **Webhook not working**: Verify the Discord webhook URL is correct and the bot has permissions to post in the channel
- **Tests failing**: Ensure you have a test Discord webhook set up or mock the environment variable in tests

## Security Note

- Never commit your `.env.local` file to version control
- The webhook URL contains sensitive tokens that should be kept private
- Consider using different webhooks for development and production environments 