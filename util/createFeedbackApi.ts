import { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { createFeedbackRecord, isAirtableConfigured } from './airtable';

interface Payload {
  user: string;
  message: string;
  rate: 'nice' | 'meh' | 'bad' | '';
  visitorId: string;
  metadata?: {
    dev?: boolean;
    [key: string]: any; // Allow extensible metadata
  };
}

interface FeedbackOptions {
  webhook?: string;
  airtableTableName?: string;
}

/**
 * Send feedback to Discord webhook (non-blocking)
 */
async function sendToDiscord(
  webhook: string,
  user: string,
  message: string,
  rate: string,
  visitorId: string,
  feedbackId: string,
  timestamp: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const username = 'HB Feedback';
    const ratingEmote =
      rate === 'nice'
        ? '😃'
        : rate === 'meh'
        ? '😐'
        : rate === 'bad'
        ? '😡'
        : '🤷‍♂️';
    
    // Determine environment
    const isDev = metadata?.dev || process.env.NODE_ENV === 'development';
    const environment = isDev ? '🔧 Development' : '🚀 Production';
    
    // Format timestamp for display
    const date = new Date(timestamp);
    const formattedTime = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Determine embed color based on rating
    let color = 0x3498db; // Default blue
    if (rate === 'nice') color = 0x2ecc71; // Green
    else if (rate === 'meh') color = 0xf39c12; // Orange
    else if (rate === 'bad') color = 0xe74c3c; // Red

    await fetch(webhook, {
      method: 'POST',
      body: JSON.stringify({
        username,
        embeds: [
          {
            title: `${ratingEmote} New Feedback Received`,
            color,
            fields: [
              {
                name: '📊 Rating',
                value: ratingEmote,
                inline: true,
              },
              {
                name: '🌍 Environment',
                value: environment,
                inline: true,
              },
              {
                name: '🆔 Feedback ID',
                value: `\`${feedbackId}\``,
                inline: true,
              },
              {
                name: '👤 Visitor ID',
                value: `\`${visitorId}\``,
                inline: true,
              },
              user && {
                name: '📧 Email',
                value: user,
                inline: true,
              },
              {
                name: '🕐 Timestamp',
                value: formattedTime,
                inline: true,
              },
              message && {
                name: '💬 Message',
                value: message.length > 1024 ? message.substring(0, 1021) + '...' : message,
                inline: false,
              },
            ].filter(Boolean),
            footer: {
              text: `Feedback ID: ${feedbackId.substring(0, 8)}...`,
            },
            timestamp,
          },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    return true;
  } catch (err) {
    console.error('Discord webhook error:', err);
    return false;
  }
}

export function createFeedbackAPI(options: FeedbackOptions) {
  return async function (req: NextApiRequest, res: NextApiResponse) {
    const { webhook, airtableTableName } = options;
    const { user, message, rate, metadata, visitorId } = req.body as Payload;
    const method = req.method;

    if (method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    // Validate that at least one storage method is configured
    const hasDiscord = !!webhook;
    const hasAirtable = isAirtableConfigured() && !!airtableTableName;

    if (!hasDiscord && !hasAirtable) {
      console.error('No feedback storage method configured');
      return res.status(500).json({
        message: 'Feedback system not configured. Please check environment variables.',
      });
    }

    // Enhance data with timestamp and additional metadata
    const timestamp = new Date().toISOString();
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const feedbackId = randomUUID(); // Unique identifier for this feedback submission

    const enhancedMetadata = {
      ...metadata,
      userAgent,
      ip: Array.isArray(ip) ? ip[0] : ip,
      timestamp,
    };

    // Prepare feedback data structure
    const feedbackData = {
      id: feedbackId, // Unique identifier for this feedback submission
      timestamp,
      email: user || undefined,
      message: message || undefined,
      rating: rate || '',
      visitorId,
      metadata: enhancedMetadata,
    };

    // Build array of storage operations for configured services only
    const storageOperations: Array<{ name: string; promise: Promise<boolean> }> = [];

    if (hasDiscord) {
      storageOperations.push({
        name: 'Discord',
        promise: sendToDiscord(webhook!, user, message, rate, visitorId, feedbackId, timestamp, metadata),
      });
    }

    if (hasAirtable) {
      storageOperations.push({
        name: 'Airtable',
        promise: createFeedbackRecord(airtableTableName || 'Feedback', feedbackData),
      });
    }

    // Execute all storage operations in parallel (non-blocking)
    const results = await Promise.allSettled(
      storageOperations.map((op) => op.promise)
    );

    // Count successes
    const successes = results.filter(
      (result) => result.status === 'fulfilled' && result.value === true
    ).length;

    // Log individual failures
    results.forEach((result, index) => {
      const serviceName = storageOperations[index]?.name || 'Unknown';
      if (result.status === 'rejected') {
        console.error(`${serviceName} storage failed:`, result.reason);
      } else if (result.status === 'fulfilled' && result.value === false) {
        console.warn(`${serviceName} storage returned false`);
      }
    });

    // Return success if at least one storage method succeeded
    if (successes > 0) {
      return res.status(200).json({
        message: 'success',
        stored: successes,
        total: storageOperations.length,
      });
    }

    // All storage methods failed
    return res.status(500).json({
      message: 'Failed to store feedback in any configured service',
    });
  };
}
