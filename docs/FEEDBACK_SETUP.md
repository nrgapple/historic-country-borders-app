# Feedback System Setup Guide

The feedback system supports multiple storage backends: Discord webhooks and Airtable. You can configure one or more of these services. At least one must be configured for the feedback system to work.

## Overview

The feedback system collects:
- **Feedback ID**: Unique identifier (UUID) for each feedback submission
- **Email** (optional): User's email address
- **Message** (optional): User's feedback message
- **Rating**: User's rating (bad/meh/nice)
- **Visitor ID**: Fingerprint-based visitor identifier (not unique - same user can submit multiple feedbacks)
- **Metadata**: Additional data including timestamp, user agent, IP address, and custom metadata

All feedback is automatically enhanced with:
- ISO timestamp
- User agent string
- IP address (from headers)
- Any custom metadata from the frontend

## Discord Webhook Setup

See [DISCORD_SETUP.md](../DISCORD_SETUP.md) for detailed Discord webhook setup instructions.

**Environment Variable:**
```bash
NEXT_PUBLIC_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

**Discord Message Format:**
The Discord webhook sends rich embed messages with:
- **Color-coded embeds** based on rating (green for nice, orange for meh, red for bad)
- **Environment indicator** (🔧 Development or 🚀 Production)
- **Feedback ID** for tracking
- **Formatted timestamp** for easy reading
- **All feedback details** including rating, email, message, and visitor ID

## Airtable Setup

> **⚠️ Migration Notice:** If you're upgrading from an older version that used `AIRTABLE_API_KEY`, you must migrate to Personal Access Tokens. API keys were deprecated on February 1, 2024 and no longer work. Update your environment variable from `AIRTABLE_API_KEY` to `AIRTABLE_PERSONAL_ACCESS_TOKEN` and create a new token following the steps below.

### 1. Create an Airtable Base

1. Go to [Airtable](https://airtable.com/) and sign in
2. Create a new base or use an existing one
3. Create a table named **Feedback** (or use your preferred name)

### 2. Set Up Table Fields

Create the following fields in your Feedback table:

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `Feedback ID` | Single line text | **Unique identifier (UUID)** for each feedback submission - mark this field as unique in Airtable |
| `Timestamp` | Date | ISO timestamp of feedback submission |
| `Email` | Email | User's email (optional) |
| `Message` | Long text | User's feedback message (optional) |
| `Rating` | Single select | Options: `bad`, `meh`, `nice` |
| `Visitor ID` | Single line text | Fingerprint-based visitor identifier (not unique - same user can submit multiple feedbacks) |
| `Environment` | Single select | **Development** or **Production** - indicates whether feedback came from dev or deployment |
| `Metadata` | Long text | JSON string of additional metadata |

**Field Configuration:**
- **Environment field**: Create a single select field with options: `Development`, `Production`

**Important:** 
- **Feedback ID** is the unique field - each feedback submission gets a unique UUID
- Mark the `Feedback ID` field as **unique** in Airtable to prevent duplicate submissions
- `Visitor ID` is NOT unique since the same user can submit multiple feedbacks

**Field Configuration:**
- **Rating field**: Create a single select field with options: `bad`, `meh`, `nice`
- **Metadata field**: Store as long text (JSON string) for flexibility

### 3. Create a Personal Access Token

**Important:** As of February 1, 2024, Airtable API keys are deprecated. You must use Personal Access Tokens instead.

1. Go to [Airtable](https://airtable.com/) and sign in
2. Click on your profile icon in the upper-right corner
3. Select **Developer hub** from the dropdown menu
4. Navigate to the **Personal Access Tokens** section
5. Click **+ Create new token**
6. Configure your token:
   - **Name**: Give it a descriptive name (e.g., "Feedback Collection")
   - **Scopes**: Select the scopes needed:
     - `data.records:read` (if you need to read records)
     - `data.records:write` (required to create feedback records)
   - **Access**: Specify which bases or workspaces the token can access
     - Select the base containing your Feedback table
7. Click **Create token**
8. **Copy the token immediately** - it will not be shown again!
9. Store it securely (you'll add it to your environment variables)

### 4. Get Your Base ID

1. Open your Airtable base
2. Go to **Help** > **API documentation**
3. The Base ID is in the URL: `https://airtable.com/YOUR_BASE_ID/api/docs`
4. Copy the Base ID

### 5. Configure Environment Variables

Add to your `.env.local` file:

```bash
AIRTABLE_PERSONAL_ACCESS_TOKEN=your_personal_access_token_here
AIRTABLE_BASE_ID=your_base_id_here
AIRTABLE_TABLE_NAME=Feedback
```

**Note:** 
- `AIRTABLE_TABLE_NAME` defaults to "Feedback" if not specified
- Never commit these credentials to version control
- Personal Access Tokens are more secure than API keys and can be scoped to specific bases

## Environment Variables Summary

Add all configured services to your `.env.local` file:

```bash
# Discord (optional but recommended for notifications)
NEXT_PUBLIC_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Airtable (optional)
AIRTABLE_PERSONAL_ACCESS_TOKEN=your_personal_access_token
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_TABLE_NAME=Feedback
```

## How It Works

1. User submits feedback through the feedback widget
2. The API receives the feedback request
3. The system enhances the data with:
   - ISO timestamp
   - User agent
   - IP address
   - Any custom metadata
4. The system attempts to store feedback in **all configured services simultaneously**:
   - Discord webhook (for notifications)
   - Airtable (for database storage)
5. The API returns success if **at least one** storage method succeeds
6. Individual failures are logged but don't block other services

## Testing

### Test the Feedback System

1. Start your development server:
   ```bash
   yarn dev
   ```

2. Use the feedback widget in the application UI

3. Check your configured services:
   - **Discord**: Check the configured channel for webhook messages
   - **Airtable**: Check the Feedback table for new records

### Run Tests

```bash
yarn test tests/api/feedback.test.ts
```

## Troubleshooting

### Airtable Issues

- **"Airtable base not available"**:
  - Verify `AIRTABLE_PERSONAL_ACCESS_TOKEN` and `AIRTABLE_BASE_ID` are set correctly
  - Check that the personal access token has the correct scopes (`data.records:write`)
  - Ensure the token has access to the base you're trying to use
  - **Note**: If you're using an old API key, you must migrate to a Personal Access Token (API keys were deprecated February 1, 2024)

- **"Field not found"**:
  - Verify your table has all required fields (see setup section)
  - Check that field names match exactly (case-sensitive)
  - Ensure the `AIRTABLE_TABLE_NAME` matches your table name

- **"Invalid field value"**:
  - Check that the Rating field has the correct options: `bad`, `meh`, `nice`
  - Verify field types match the expected data types

### General Issues

- **"No feedback storage method configured"**:
  - Ensure at least one service (Discord or Airtable) is configured
  - Check that environment variables are set correctly

- **"Failed to store feedback in any configured service"**:
  - Check server logs for specific error messages
  - Verify network connectivity
  - Check API credentials and permissions

## Security Best Practices

1. **Never commit credentials to version control**
   - Use `.env.local` for local development
   - Use your hosting platform's environment variable system for production

2. **Rotate credentials regularly**
   - Regenerate Airtable Personal Access Tokens if compromised

3. **Use separate credentials for development and production**
   - Different Discord webhooks
   - Different Airtable bases or tables

4. **Limit permissions**
   - Airtable Personal Access Tokens should be scoped to specific bases and have minimal required scopes

5. **Monitor access**
   - Regularly review who has access to your Airtable bases
   - Monitor Airtable API usage in your account settings

## Data Structure

Each feedback submission includes:

```typescript
{
  id: string;              // Unique identifier (UUID) for this feedback submission
  timestamp: string;        // ISO 8601 timestamp
  email?: string;           // User email (optional)
  message?: string;         // Feedback message (optional)
  rating: string;          // 'bad' | 'meh' | 'nice'
  visitorId: string;       // Fingerprint-based ID (not unique - same user can submit multiple)
  metadata: {              // Enhanced metadata
    userAgent: string;     // Browser user agent
    ip: string;            // IP address
    timestamp: string;     // Duplicate timestamp
    dev?: boolean;         // Development flag
    [key: string]: any;    // Additional custom fields
  }
}
```

**Key Points:**
- `id` is a unique UUID generated for each feedback submission
- `visitorId` is NOT unique - the same user can submit multiple feedbacks
- Use `id` as the unique identifier in Airtable (mark the field as unique)

## Extending the System

To add more metadata fields:

1. Update the frontend to include additional data in the `metadata` object
2. The system will automatically include it in all storage backends
3. For Airtable: Add new fields to your table schema

The metadata object is flexible and can include any JSON-serializable data.

