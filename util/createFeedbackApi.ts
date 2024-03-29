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

export function createFeedbackAPI(options: { webhook: string }) {
  return async function (req: NextApiRequest, res: NextApiResponse) {
    const { webhook } = options;
    const { user, message, rate, metadata, visitorId } = req.body as Payload;
    const method = req.method;
    if (method !== 'POST') throw new Error('Method not allowed');

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
      let message = err;

      if (err instanceof TypeError) {
        message = err.message;
      }

      return res.status(400).json({ message });
    }
  };
}
