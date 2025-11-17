import { NextApiRequest, NextApiResponse } from 'next';
import { createFeedbackAPI } from '../../util/createFeedbackApi';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const feedbackAPI = createFeedbackAPI({
    webhook: process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL,
    airtableTableName: process.env.AIRTABLE_TABLE_NAME || 'Feedback',
  });
  
  return feedbackAPI(req, res);
}
