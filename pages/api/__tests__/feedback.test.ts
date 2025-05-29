import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../feedback'

// Mock fetch
global.fetch = vi.fn()

describe('/api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock environment variable
    process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/webhook'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle POST request successfully', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        user: 'test@example.com',
        message: 'Test feedback message',
        rate: 'nice',
        visitorId: 'test-visitor-id',
        metadata: { dev: true }
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(JSON.parse(res._getData())).toEqual({ message: 'success' })
    
    // Check that fetch was called with correct Discord webhook payload
    expect(fetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test/webhook',
      {
        method: 'POST',
        body: JSON.stringify({
          username: 'HB Feedback',
          content: 'A user has left feedback!',
          embeds: [
            {
              fields: [
                {
                  name: 'Visitor ID',
                  value: 'test-visitor-id',
                },
                {
                  name: 'User',
                  value: 'test@example.com',
                },
                {
                  name: 'Message',
                  value: 'Test feedback message',
                },
                {
                  name: 'Rating',
                  value: '😃',
                },
                {
                  name: 'Dev',
                  value: true,
                },
              ],
            },
          ],
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    )
  })

  it('should handle missing webhook URL', async () => {
    // Save original value and remove the environment variable
    const originalWebhookUrl = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL
    process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL = ''

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        user: 'test@example.com',
        message: 'Test feedback message',
        rate: 'nice',
        visitorId: 'test-visitor-id'
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
    const responseData = JSON.parse(res._getData())
    expect(responseData.message).toBe('Feedback system not configured. Please check environment variables.')

    // Restore original value
    if (originalWebhookUrl) {
      process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL = originalWebhookUrl
    }
  })

  it('should handle Discord API errors', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockRejectedValueOnce(new Error('Discord API error'))

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        user: 'test@example.com',
        message: 'Test feedback message',
        rate: 'nice',
        visitorId: 'test-visitor-id'
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const responseData = JSON.parse(res._getData())
    expect(responseData.message).toBe('Discord API error')
  })

  it('should reject non-POST methods', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
    const responseData = JSON.parse(res._getData())
    expect(responseData.message).toBe('Method not allowed')
  })

  it('should handle different rating types', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        rate: 'bad',
        visitorId: 'test-visitor-id'
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    
    // Check that the correct emoji was used for 'bad' rating
    const fetchCall = mockFetch.mock.calls[0]
    if (fetchCall && fetchCall[1] && 'body' in fetchCall[1]) {
      const body = JSON.parse(fetchCall[1].body as string)
      const ratingField = body.embeds[0].fields.find((field: any) => field.name === 'Rating')
      expect(ratingField.value).toBe('😡')
    }
  })

  it('should handle optional fields correctly', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        rate: 'meh',
        visitorId: 'test-visitor-id'
        // No user, message, or metadata
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    
    // Check that only required fields are present
    const fetchCall = mockFetch.mock.calls[0]
    if (fetchCall && fetchCall[1] && 'body' in fetchCall[1]) {
      const body = JSON.parse(fetchCall[1].body as string)
      const fields = body.embeds[0].fields
      
      expect(fields).toHaveLength(2) // Only Visitor ID and Rating
      expect(fields.find((field: any) => field.name === 'Visitor ID')).toBeTruthy()
      expect(fields.find((field: any) => field.name === 'Rating')).toBeTruthy()
      expect(fields.find((field: any) => field.name === 'User')).toBeFalsy()
      expect(fields.find((field: any) => field.name === 'Message')).toBeFalsy()
    }
  })
}) 