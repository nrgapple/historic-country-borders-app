import { NextApiRequest, NextApiResponse } from 'next';

interface Payload {
  user: string;
  message: string;
  rate: 'nice' | 'meh' | 'bad' | '';
  visitorId: string;
  metadata?: {
    dev?: boolean;
  };
}

export function createFeedbackAPI(options: { webhook: string | undefined }) {
  return async function (req: NextApiRequest, res: NextApiResponse) {
    const { webhook } = options;
    const { user, message, rate, metadata, visitorId } = req.body as Payload;
    const method = req.method;
    if (method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    if (!webhook) {
      console.error('Discord webhook URL not configured');
      return res.status(500).json({ 
        message: 'Feedback system not configured. Please check environment variables.' 
      });
    }

    const username = 'HB Feedback';
    const ratingEmote =
      rate === 'nice'
        ? '😃'
        : rate === 'meh'
        ? '😐'
        : rate === 'bad'
        ? '😡'
        : '🤷‍♂️';

    try {
      await fetch(webhook, {
        method: 'POST',
        body: JSON.stringify({
          username,
          content: 'A user has left feedback!',
          embeds: [
            {
              fields: [
                {
                  name: 'Visitor ID',
                  value: visitorId,
                },
                user && {
                  name: 'User',
                  value: user,
                },
                message && {
                  name: 'Message',
                  value: message,
                },
                {
                  name: 'Rating',
                  value: ratingEmote,
                },
                metadata?.dev && {
                  name: 'Dev',
                  value: true,
                },
              ].filter(Boolean),
            },
          ],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      return res.status(200).json({ message: 'success' });
    } catch (err) {
      console.error('Discord webhook error:', err);
      let message = 'Failed to send feedback';

      if (err instanceof Error) {
        message = err.message;
      }

      return res.status(400).json({ message });
    }
  };
}
