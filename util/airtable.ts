import Airtable from 'airtable';

interface FeedbackData {
  id: string; // Unique identifier for this feedback submission
  timestamp: string;
  email?: string;
  message?: string;
  rating: string;
  visitorId: string;
  metadata?: Record<string, any>;
}

let airtableBase: Airtable.Base | null = null;

/**
 * Initialize Airtable base connection
 */
function getAirtableBase(): Airtable.Base | null {
  if (airtableBase) {
    return airtableBase;
  }

  const personalAccessToken = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!personalAccessToken || !baseId) {
    console.warn('Airtable credentials not configured');
    return null;
  }

  try {
    // Personal access tokens are used the same way as API keys in the SDK
    Airtable.configure({ apiKey: personalAccessToken });
    airtableBase = Airtable.base(baseId);
    return airtableBase;
  } catch (error) {
    console.error('Failed to initialize Airtable base:', error);
    return null;
  }
}

/**
 * Create a feedback record in Airtable
 * @param tableName - Name of the Airtable table (default: "Feedback")
 * @param data - Feedback data to create
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function createFeedbackRecord(
  tableName: string,
  data: FeedbackData
): Promise<boolean> {
  try {
    const base = getAirtableBase();
    if (!base) {
      console.warn('Airtable base not available');
      return false;
    }

    const table = base(tableName);

    // Determine environment (dev or production)
    const isDev = data.metadata?.dev || process.env.NODE_ENV === 'development';
    const environment = isDev ? 'Development' : 'Production';

    // Map feedback data to Airtable fields
    // Adjust field names based on your Airtable schema
    const fields: Record<string, any> = {
      'Feedback ID': data.id, // Unique identifier for this feedback submission
      'Timestamp': data.timestamp,
      'Rating': data.rating,
      'Visitor ID': data.visitorId,
      'Environment': environment, // Dev or Production
    };

    // Add optional fields if they exist
    if (data.email) {
      fields['Email'] = data.email;
    }

    if (data.message) {
      fields['Message'] = data.message;
    }

    if (data.metadata && Object.keys(data.metadata).length > 0) {
      // Store metadata as JSON string or individual fields based on your schema
      fields['Metadata'] = JSON.stringify(data.metadata);
    }

    await table.create(fields);

    return true;
  } catch (error) {
    console.error('Failed to create feedback record in Airtable:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return false;
  }
}

/**
 * Check if Airtable is configured
 */
export function isAirtableConfigured(): boolean {
  return !!(
    process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN &&
    process.env.AIRTABLE_BASE_ID &&
    process.env.AIRTABLE_TABLE_NAME
  );
}

