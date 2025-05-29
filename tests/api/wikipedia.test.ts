import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/wikipedia'

// Mock fetch
global.fetch = vi.fn()

// Mock wikijs
const mockPage = {
  summary: vi.fn(),
}

const mockWiki = {
  search: vi.fn(),
  page: vi.fn().mockResolvedValue(mockPage),
  find: vi.fn().mockResolvedValue(mockPage),
}

vi.mock('wikijs', () => ({
  default: vi.fn(() => mockWiki),
}))

describe('/api/wikipedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWiki.search.mockResolvedValue({
      results: ['France']
    })
    mockWiki.page.mockResolvedValue(mockPage)
    mockPage.summary.mockResolvedValue('France is a country in Europe.')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle POST request successfully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        name: 'France',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.content).toBe('France is a country in Europe.')
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

  it('should return 400 for missing name', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {},
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.error).toBe('Name is required')
  })

  it('should handle empty name', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        name: '',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.error).toBe('Name is required')
  })

  it('should handle wikijs errors and fallback to direct API', async () => {
    mockWiki.search.mockRejectedValue(new Error('Wikijs error'))

    const mockSearchResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(['France search', ['France'], [], []])
    }

    const mockPageResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        query: {
          pages: {
            '123': {
              extract: 'France is a country in Western Europe.'
            }
          }
        }
      })
    }

    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockSearchResponse)
      .mockResolvedValueOnce(mockPageResponse)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        name: 'France',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.content).toBe('France is a country in Western Europe.')
  })

  it('should return "Not Found" when no results are found', async () => {
    mockWiki.search.mockRejectedValue(new Error('Wikijs error'))

    const mockSearchResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(['NonexistentPlace', [], [], []])
    }

    global.fetch = vi.fn().mockResolvedValue(mockSearchResponse)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        name: 'NonexistentPlace',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.content).toBe('Not Found')
  })

  it('should handle complete failure gracefully', async () => {
    mockWiki.search.mockRejectedValue(new Error('Wikijs error'))
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        name: 'Test Place',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.content).toBe('Unable to load Wikipedia information')
  })

  it('should truncate long content', async () => {
    const longContent = 'A'.repeat(600) // Content longer than 500 characters
    mockPage.summary.mockResolvedValue(longContent)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        name: 'Test Place',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.content).toHaveLength(503) // 500 + '...'
    expect(data.content.endsWith('...')).toBe(true)
  })
}) 