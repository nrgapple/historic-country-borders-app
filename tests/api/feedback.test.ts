import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/feedback'

// Mock fetch
global.fetch = vi.fn()

// Mock Airtable
vi.mock('../../util/airtable', () => ({
  createFeedbackRecord: vi.fn(),
  isAirtableConfigured: vi.fn(),
}))

import { createFeedbackRecord, isAirtableConfigured } from '../../util/airtable'

describe('/api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock environment variables
    process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/webhook'
    process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN = ''
    process.env.AIRTABLE_BASE_ID = ''
    process.env.AIRTABLE_TABLE_NAME = 'Feedback'
    
    // Default mocks - all services not configured
    vi.mocked(isAirtableConfigured).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle POST request successfully with Discord only', async () => {
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
    const responseData = JSON.parse(res._getData())
    expect(responseData.message).toBe('success')
    expect(responseData.stored).toBe(1)
    expect(responseData.total).toBe(1)
    
    // Check that fetch was called with correct Discord webhook payload
    expect(fetch).toHaveBeenCalled()
    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[0]).toBe('https://discord.com/api/webhooks/test/webhook')
    
    if (fetchCall && fetchCall[1] && 'body' in fetchCall[1]) {
      const body = JSON.parse(fetchCall[1].body as string)
      expect(body.username).toBe('HB Feedback')
      expect(body.embeds).toBeDefined()
      expect(body.embeds[0].title).toContain('New Feedback Received')
      expect(body.embeds[0].color).toBeDefined()
      
      const fields = body.embeds[0].fields
      expect(fields.find((f: any) => f.name.includes('Rating'))?.value).toBe('😃')
      expect(fields.find((f: any) => f.name.includes('Environment'))?.value).toContain('Development')
      expect(fields.find((f: any) => f.name.includes('Email'))?.value).toBe('test@example.com')
      expect(fields.find((f: any) => f.name.includes('Message'))?.value).toBe('Test feedback message')
    }
  })

  it('should handle missing webhook URL when no other services configured', async () => {
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

  it('should work with Airtable only', async () => {
    process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL = ''
    process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN = 'test-token'
    process.env.AIRTABLE_BASE_ID = 'test-base-id'
    process.env.AIRTABLE_TABLE_NAME = 'Feedback'
    
    vi.mocked(isAirtableConfigured).mockReturnValue(true)
    vi.mocked(createFeedbackRecord).mockResolvedValueOnce(true)

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

    expect(res._getStatusCode()).toBe(200)
    const responseData = JSON.parse(res._getData())
    expect(responseData.message).toBe('success')
    expect(responseData.stored).toBe(1)
    expect(responseData.total).toBe(1)
    expect(createFeedbackRecord).toHaveBeenCalledWith(
      'Feedback',
      expect.objectContaining({
        timestamp: expect.any(String),
        email: 'test@example.com',
        message: 'Test feedback message',
        rating: 'nice',
        visitorId: 'test-visitor-id',
      })
    )
  })

  it('should work with both services', async () => {
    process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN = 'test-token'
    process.env.AIRTABLE_BASE_ID = 'test-base-id'
    
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)
    
    vi.mocked(isAirtableConfigured).mockReturnValue(true)
    vi.mocked(createFeedbackRecord).mockResolvedValueOnce(true)

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

    expect(res._getStatusCode()).toBe(200)
    const responseData = JSON.parse(res._getData())
    expect(responseData.message).toBe('success')
    expect(responseData.stored).toBe(2)
    expect(responseData.total).toBe(2)
    expect(fetch).toHaveBeenCalled()
    expect(createFeedbackRecord).toHaveBeenCalled()
  })

  it('should succeed if at least one service succeeds', async () => {
    process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN = 'test-token'
    process.env.AIRTABLE_BASE_ID = 'test-base-id'
    
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockRejectedValueOnce(new Error('Discord failed'))
    
    vi.mocked(isAirtableConfigured).mockReturnValue(true)
    vi.mocked(createFeedbackRecord).mockResolvedValueOnce(true)

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

    expect(res._getStatusCode()).toBe(200)
    const responseData = JSON.parse(res._getData())
    expect(responseData.message).toBe('success')
    expect(responseData.stored).toBe(1) // Only Airtable succeeded
    expect(responseData.total).toBe(2)
  })

  it('should fail if all services fail', async () => {
    process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN = 'test-token'
    process.env.AIRTABLE_BASE_ID = 'test-base-id'
    
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockRejectedValueOnce(new Error('Discord failed'))
    
    vi.mocked(isAirtableConfigured).mockReturnValue(true)
    vi.mocked(createFeedbackRecord).mockResolvedValueOnce(false)

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
    expect(responseData.message).toBe('Failed to store feedback in any configured service')
  })

  it('should handle Discord API errors gracefully', async () => {
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

    // With only Discord configured and it failing, should return 500
    expect(res._getStatusCode()).toBe(500)
    const responseData = JSON.parse(res._getData())
    expect(responseData.message).toBe('Failed to store feedback in any configured service')
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
      const ratingField = body.embeds[0].fields.find((field: any) => field.name.includes('Rating'))
      expect(ratingField).toBeDefined()
      expect(ratingField.value).toBe('😡')
    }
  })

  it('should enhance data with timestamp and metadata', async () => {
    process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN = 'test-token'
    process.env.AIRTABLE_BASE_ID = 'test-base-id'
    
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)
    
    vi.mocked(isAirtableConfigured).mockReturnValue(true)
    vi.mocked(createFeedbackRecord).mockResolvedValueOnce(true)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'user-agent': 'test-user-agent',
        'x-forwarded-for': '192.168.1.1',
      },
      body: {
        rate: 'nice',
        visitorId: 'test-visitor-id',
        metadata: { customField: 'customValue' }
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    
    // Verify that Airtable receives enhanced data
    expect(createFeedbackRecord).toHaveBeenCalledWith(
      'Feedback',
      expect.objectContaining({
        id: expect.any(String),
        timestamp: expect.any(String),
        rating: 'nice',
        visitorId: 'test-visitor-id',
        metadata: expect.objectContaining({
          customField: 'customValue',
          userAgent: 'test-user-agent',
          ip: '192.168.1.1',
          timestamp: expect.any(String),
        }),
      })
    )
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
    
    // Check that required fields are present and optional fields are not
    const fetchCall = mockFetch.mock.calls[0]
    if (fetchCall && fetchCall[1] && 'body' in fetchCall[1]) {
      const body = JSON.parse(fetchCall[1].body as string)
      const fields = body.embeds[0].fields
      
      // Should have Rating, Environment, Feedback ID, Visitor ID, and Timestamp
      expect(fields.length).toBeGreaterThanOrEqual(5)
      expect(fields.find((field: any) => field.name.includes('Rating'))).toBeTruthy()
      expect(fields.find((field: any) => field.name.includes('Environment'))).toBeTruthy()
      expect(fields.find((field: any) => field.name.includes('Feedback ID'))).toBeTruthy()
      expect(fields.find((field: any) => field.name.includes('Visitor ID'))).toBeTruthy()
      expect(fields.find((field: any) => field.name.includes('Timestamp'))).toBeTruthy()
      // Optional fields should not be present
      expect(fields.find((field: any) => field.name.includes('Email'))).toBeFalsy()
      expect(fields.find((field: any) => field.name.includes('Message'))).toBeFalsy()
    }
  })
}) 