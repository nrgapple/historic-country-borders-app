import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../ai'

// Mock fetch
global.fetch = vi.fn()

// Mock ReactGA4
vi.mock('react-ga4', () => ({
  default: {
    event: vi.fn(),
  },
}))

// Mock redis cache
vi.mock('../../../lib/redis', () => ({
  redisCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}))

describe('/api/ai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('should handle POST request successfully', async () => {
    const mockGeminiResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{
              text: 'France in 1500 was a powerful kingdom under the Valois dynasty.'
            }]
          }
        }]
      })
    }

    global.fetch = vi.fn().mockResolvedValue(mockGeminiResponse)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        countryName: 'France',
        year: '1500',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.content).toBe('France in 1500 was a powerful kingdom under the Valois dynasty.')
  })

  it('should return 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
    const data = JSON.parse(res._getData())
    expect(data.error).toBe('Method not allowed')
  })

  it('should return 400 for missing country name', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        year: '1500',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.error).toBe('Country name is required')
  })

  it('should return 400 for missing year', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        countryName: 'France',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.error).toBe('Year is required')
  })

  it('should return 500 when no API key is configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        countryName: 'France',
        year: '1500',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
    const data = JSON.parse(res._getData())
    expect(data.error).toBe('AI information requires Gemini API key setup. Please check the README or switch to Wikipedia.')
  })

  it('should handle Gemini API errors', async () => {
    const mockGeminiResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: vi.fn().mockResolvedValue('{"error":{"code":429,"message":"Quota exceeded"}}')
    }

    global.fetch = vi.fn().mockResolvedValue(mockGeminiResponse)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        countryName: 'France',
        year: '1500',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(429)
    const data = JSON.parse(res._getData())
    expect(data.error).toContain('AI service has reached its daily quota limit')
  })

  it('should handle network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        countryName: 'France',
        year: '1500',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
    const data = JSON.parse(res._getData())
    expect(data.error).toBe('Something went wrong with AI information. Please try again or switch to Wikipedia.')
  })
}) 