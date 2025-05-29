import type { NextApiRequest, NextApiResponse } from 'next';
import ReactGA4 from 'react-ga4';
import { redisCache } from '../../lib/redis';

// Google Gemini API - generous free tier (60 requests/minute, no credit card required)
// Get your free API key at: https://ai.google.dev/gemini-api/docs/api-key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

// Cache TTL in seconds (24 hours to reduce API calls and manage quota)
const CACHE_TTL = 86400;

/**
 * Generates a contextual prompt for AI to compare two geographical/political entities
 * as they existed in specific years, accounting for different types of entities
 * (countries, territories, tribes, city-states, etc.)
 */
const generateComparisonPrompt = (
  country1: { name: string; year: string },
  country2: { name: string; year: string }
): string => {
  return `Compare ${country1.name} in ${country1.year} with ${country2.name} in ${country2.year}. Be historically accurate for those exact time periods. Both entities might be:
- Sovereign nations or kingdoms
- Territories, colonies, or protectorates
- Tribal confederations or indigenous groups
- City-states or principalities
- Multiple competing states or regions
- Parts of larger empires or federations

Provide a comprehensive comparison (under 300 words) that includes:

1. **Political Structure**: How each entity was governed and organized in their respective years
2. **Territorial Control**: Size, boundaries, and geographical extent of each
3. **Economic System**: Trade, agriculture, industry, and economic development
4. **Cultural/Social Aspects**: Key cultural practices, religion, society structure
5. **Historical Context**: What major events or circumstances shaped each entity during those years
6. **Key Differences**: The most significant contrasts between them
7. **Similarities**: Any notable parallels or shared characteristics

If either entity didn't exist as a unified political entity in the specified year, describe what existed in that geographical area instead (tribes, competing kingdoms, part of larger empire, etc.) and compare accordingly.

Focus on factual historical information for ${country1.year} and ${country2.year} specifically, not modern borders or names.`;
};

interface AICompareRequest {
  country1: { name: string; year: string };
  country2: { name: string; year: string };
}

interface AICompareResponse {
  content: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AICompareResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ content: '', error: 'Method not allowed' });
  }

  const { country1, country2 }: AICompareRequest = req.body;

  const startTime = Date.now();
  
  if (!country1?.name || country1.name.trim() === '') {
    return res.status(400).json({ content: '', error: 'Country 1 name is required' });
  }

  if (!country1?.year || country1.year.trim() === '') {
    return res.status(400).json({ content: '', error: 'Country 1 year is required' });
  }

  if (!country2?.name || country2.name.trim() === '') {
    return res.status(400).json({ content: '', error: 'Country 2 name is required' });
  }

  if (!country2?.year || country2.year.trim() === '') {
    return res.status(400).json({ content: '', error: 'Country 2 year is required' });
  }

  // Create cache key
  const cacheKey = `ai-compare:${country1.name.toLowerCase().replace(/\s+/g, '_')}:${country1.year}:${country2.name.toLowerCase().replace(/\s+/g, '_')}:${country2.year}`;
  
  try {
    // Try to get cached response first
    const cachedResponse = await redisCache.get<string>(cacheKey);
    if (cachedResponse) {
      console.log('Cache hit for AI compare request:', {
        country1,
        country2,
        cacheKey,
        timestamp: new Date().toISOString(),
      });

      // Track cache hit
      ReactGA4.event('ai_compare_cache_hit', {
        country1_name: country1.name,
        country1_year: country1.year,
        country2_name: country2.name,
        country2_year: country2.year,
        cache_key: cacheKey,
        cache_type: 'redis'
      });

      return res.status(200).json({ content: cachedResponse });
    }

    console.log('Cache miss for AI compare request:', {
      country1,
      country2,
      cacheKey,
      timestamp: new Date().toISOString(),
    });

    // Track cache miss
    ReactGA4.event('ai_compare_cache_miss', {
      country1_name: country1.name,
      country1_year: country1.year,
      country2_name: country2.name,
      country2_year: country2.year,
      cache_key: cacheKey,
      cache_type: 'redis'
    });
  } catch (cacheError) {
    console.warn('Redis cache error (continuing without cache):', {
      country1,
      country2,
      cacheKey,
      error: cacheError instanceof Error ? cacheError.message : 'Unknown cache error',
      timestamp: new Date().toISOString(),
    });

    // Track cache error
    ReactGA4.event('ai_compare_cache_error', {
      country1_name: country1.name,
      country1_year: country1.year,
      country2_name: country2.name,
      country2_year: country2.year,
      cache_key: cacheKey,
      error_type: 'cache_operation_failed',
      cache_type: 'redis'
    });
  }

  // Check API key (now server-side only)
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

  // If no API key is provided, return error message
  if (!GEMINI_API_KEY) {
    console.log('No Gemini API key provided', {
      country1,
      country2,
      timestamp: new Date().toISOString(),
    });

    // Track missing API key
    ReactGA4.event('ai_compare_api_key_missing', {
      country1_name: country1.name,
      country1_year: country1.year,
      country2_name: country2.name,
      country2_year: country2.year,
      error_type: 'missing_api_key',
      api_provider: 'gemini'
    });

    return res.status(500).json({ 
      content: '', 
      error: 'AI comparison requires Gemini API key setup. Please check the README.' 
    });
  }

  // Track AI compare request initiation
  ReactGA4.event('ai_compare_request_start', {
    country1_name: country1.name,
    country1_year: country1.year,
    country2_name: country2.name,
    country2_year: country2.year,
    year_span: Math.abs(parseInt(country2.year) - parseInt(country1.year)),
    same_year: country1.year === country2.year,
    api_provider: 'gemini'
  });

  try {
    // Create a focused prompt for Gemini
    const prompt = generateComparisonPrompt(country1, country2);

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 400, // More tokens for comparison content
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error('Gemini API HTTP error:', {
        status: response.status,
        statusText: response.statusText,
        country1,
        country2,
        errorBody: errorText,
        timestamp: new Date().toISOString(),
      });

      // Handle specific error types
      if (response.status === 429) {
        // Parse error response to get quota details
        let quotaExceeded = false;
        let retryDelay = null;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.code === 429) {
            quotaExceeded = true;
            // Extract retry delay if available
            const retryInfo = errorData.error.details?.find(
              (detail: any) => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
            );
            if (retryInfo?.retryDelay) {
              retryDelay = retryInfo.retryDelay;
            }
          }
        } catch (parseError) {
          console.warn('Could not parse 429 error response:', parseError);
        }

        // Track quota exceeded
        ReactGA4.event('ai_compare_quota_exceeded', {
          country1_name: country1.name,
          country1_year: country1.year,
          country2_name: country2.name,
          country2_year: country2.year,
          response_time_ms: Math.round(responseTime),
          api_provider: 'gemini',
          error_code: 429
        });

        // Track response time for quota exceeded requests
        ReactGA4.event('ai_compare_response_time', {
          country1_name: country1.name,
          country1_year: country1.year,
          country2_name: country2.name,
          country2_year: country2.year,
          response_time_ms: Math.round(responseTime),
          request_status: 'quota_exceeded',
          api_provider: 'gemini'
        });

        if (quotaExceeded) {
          const retryMessage = retryDelay ? ` (retry after ${retryDelay})` : '';
          return res.status(429).json({ 
            content: '', 
            error: `AI service has reached its daily quota limit${retryMessage}. Please try again tomorrow.` 
          });
        }
      }

      // Track API error
      ReactGA4.event('ai_compare_api_error', {
        country1_name: country1.name,
        country1_year: country1.year,
        country2_name: country2.name,
        country2_year: country2.year,
        error_code: response.status,
        response_time_ms: Math.round(responseTime),
        api_provider: 'gemini',
        error_type: response.status === 429 ? 'rate_limit' : 
                   response.status === 401 ? 'authentication' : 
                   response.status >= 500 ? 'server_error' : 'client_error'
      });

      // Track response time for failed requests
      ReactGA4.event('ai_compare_response_time', {
        country1_name: country1.name,
        country1_year: country1.year,
        country2_name: country2.name,
        country2_year: country2.year,
        response_time_ms: Math.round(responseTime),
        request_status: 'error',
        api_provider: 'gemini'
      });

      return res.status(response.status).json({ 
        content: '', 
        error: `HTTP error! status: ${response.status} - ${response.statusText}` 
      });
    }

    const data = await response.json();
    
    console.log('Gemini API response for comparison:', {
      country1,
      country2,
      responseType: typeof data,
      hasContent: !!data.candidates,
      timestamp: new Date().toISOString(),
    });
    
    // Handle Gemini API response format
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      const content = data.candidates[0].content.parts[0].text || '';
      
      console.log('AI compare text processing:', {
        country1,
        country2,
        contentLength: content.length,
        timestamp: new Date().toISOString(),
      });

      const trimmedContent = content.trim();
      
      if (trimmedContent) {
        // Cache the successful response ONLY - we never cache error responses
        // This ensures only valid AI content is served from cache
        try {
          await redisCache.set(cacheKey, trimmedContent, CACHE_TTL);
          console.log('Successfully cached AI compare response:', {
            country1,
            country2,
            cacheKey,
            ttl: CACHE_TTL,
            contentLength: trimmedContent.length,
            timestamp: new Date().toISOString(),
          });

          // Track successful cache write
          ReactGA4.event('ai_compare_cache_write_success', {
            country1_name: country1.name,
            country1_year: country1.year,
            country2_name: country2.name,
            country2_year: country2.year,
            cache_key: cacheKey,
            content_length: trimmedContent.length,
            cache_type: 'redis',
            ttl_seconds: CACHE_TTL
          });
        } catch (cacheWriteError) {
          console.warn('Failed to cache AI compare response (continuing normally):', {
            country1,
            country2,
            cacheKey,
            error: cacheWriteError instanceof Error ? cacheWriteError.message : 'Unknown cache write error',
            timestamp: new Date().toISOString(),
          });

          // Track cache write error
          ReactGA4.event('ai_compare_cache_write_error', {
            country1_name: country1.name,
            country1_year: country1.year,
            country2_name: country2.name,
            country2_year: country2.year,
            cache_key: cacheKey,
            error_type: 'cache_write_failed',
            cache_type: 'redis'
          });
        }

        // Track successful AI compare response
        ReactGA4.event('ai_compare_response_success', {
          country1_name: country1.name,
          country1_year: country1.year,
          country2_name: country2.name,
          country2_year: country2.year,
          response_time_ms: Math.round(responseTime),
          content_length: trimmedContent.length,
          word_count: trimmedContent.split(/\s+/).length,
          api_provider: 'gemini'
        });

        // Track response time for successful requests
        ReactGA4.event('ai_compare_response_time', {
          country1_name: country1.name,
          country1_year: country1.year,
          country2_name: country2.name,
          country2_year: country2.year,
          response_time_ms: Math.round(responseTime),
          request_status: 'success',
          api_provider: 'gemini'
        });

        // Track response quality metrics
        const wordCount = trimmedContent.split(/\s+/).length;
        ReactGA4.event('ai_compare_content_quality', {
          country1_name: country1.name,
          country1_year: country1.year,
          country2_name: country2.name,
          country2_year: country2.year,
          content_length: trimmedContent.length,
          word_count: wordCount,
          quality_rating: wordCount < 50 ? 'brief' : wordCount < 150 ? 'moderate' : 'detailed',
          year_span: Math.abs(parseInt(country2.year) - parseInt(country1.year))
        });

        return res.status(200).json({ content: trimmedContent });
      } else {
        // Track empty response
        ReactGA4.event('ai_compare_response_empty', {
          country1_name: country1.name,
          country1_year: country1.year,
          country2_name: country2.name,
          country2_year: country2.year,
          response_time_ms: Math.round(responseTime),
          api_provider: 'gemini',
          error_type: 'empty_content'
        });

        return res.status(200).json({ 
          content: 'AI generated empty comparison response. Please try again.' 
        });
      }
    }

    console.warn('Unexpected API response format for comparison:', {
      country1,
      country2,
      responseData: data,
      timestamp: new Date().toISOString(),
    });

    // Track unexpected response format
    ReactGA4.event('ai_compare_response_format_error', {
      country1_name: country1.name,
      country1_year: country1.year,
      country2_name: country2.name,
      country2_year: country2.year,
      response_time_ms: Math.round(responseTime),
      api_provider: 'gemini',
      error_type: 'unexpected_format'
    });
    
    return res.status(200).json({ 
      content: 'AI returned unexpected response format. Please try again.' 
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('Gemini API error for comparison:', error);
    console.error('Error details:', {
      country1,
      country2,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Track request failure
    ReactGA4.event('ai_compare_request_failed', {
      country1_name: country1.name,
      country1_year: country1.year,
      country2_name: country2.name,
      country2_year: country2.year,
      error_message: error instanceof Error ? error.message : 'unknown_error',
      error_type: error instanceof Error ? error.name : 'UnknownError',
      response_time_ms: Math.round(responseTime),
      api_provider: 'gemini'
    });

    // Track specific error categorization
    const errorCategory = error instanceof Error && error.message.includes('429') ? 'rate_limit' :
                         error instanceof Error && error.message.includes('fetch') ? 'network_error' :
                         error instanceof Error && error.message.includes('401') ? 'authentication' :
                         error instanceof Error && error.message.includes('timeout') ? 'timeout' : 'api_error';
    
    ReactGA4.event('ai_compare_error_categorized', {
      country1_name: country1.name,
      country1_year: country1.year,
      country2_name: country2.name,
      country2_year: country2.year,
      error_category: errorCategory,
      error_name: error instanceof Error ? error.name : 'UnknownError',
      response_time_ms: Math.round(responseTime),
      api_provider: 'gemini'
    });

    // Track response time for failed requests
    ReactGA4.event('ai_compare_response_time', {
      country1_name: country1.name,
      country1_year: country1.year,
      country2_name: country2.name,
      country2_year: country2.year,
      response_time_ms: Math.round(responseTime),
      request_status: 'failed',
      api_provider: 'gemini'
    });
    
    // Return specific error message instead of generic fallback
    return res.status(500).json({ content: '', error: 'Something went wrong with AI comparison. Please try again.' });
  }
} 