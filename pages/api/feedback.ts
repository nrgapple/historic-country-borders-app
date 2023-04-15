import { createFeedbackAPI } from '../../util/createFeedbackApi';

export default createFeedbackAPI({
  webhook: process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL,
});
