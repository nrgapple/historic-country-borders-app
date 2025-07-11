import type { NextApiRequest, NextApiResponse } from 'next';
import ReactGA4 from 'react-ga4';
import { redisCache } from '../../lib/redis';

// Google Gemini API - generous free tier (60 requests/minute, no credit card required)
// Get your free API key at: https://ai.google.dev/gemini-api/docs/api-key
// 
// QUOTA MANAGEMENT:
// - Free tier: 500 requests per day per project
// - To reduce quota usage: increase CACHE_TTL and implement request throttling
// - Consider using a paid plan for higher quotas if needed
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

// Cache TTL in seconds (24 hours to reduce API calls and manage quota)
const CACHE_TTL = 86400;

/**
 * Generates a contextual prompt for AI to describe a geographical/political entity
 * as it existed in a specific year, accounting for different types of entities
 * (countries, territories, tribes, city-states, etc.)
 */
const generateHistoricalPrompt = (entityName: string, year: string): string => {
  return `Describe ${entityName} as it existed specifically in the year ${year}. Be historically accurate for that exact time period. The entity might be:
- A sovereign nation or kingdom
- A territory, colony, or protectorate
- A tribal confederation or indigenous group
- A city-state or principality
- Multiple competing states or regions
- Part of a larger empire or federation

Provide a brief, engaging paragraph (under 100 words) that includes:
1. What type of political/geographical entity it was in ${year}
2. Its location and approximate boundaries
3. Who controlled or governed it (if applicable)
4. 2-3 interesting facts about its culture, society, or significance during that specific time period

If the entity didn't exist as a unified political entity in ${year}, describe what existed in that geographical area instead (tribes, competing kingdoms, part of larger empire, etc.). Focus on what was actually happening in ${year}, not modern borders or names.`;
};

interface AIRequest {
  countryName: string;
  year: string;
}

interface AIResponse {
  content: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AIResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ content: '', error: 'Method not allowed' });
  }

  const { countryName, year }: AIRequest = req.body;

  const startTime = Date.now();
  
  if (!countryName || countryName.trim() === '') {
    return res.status(400).json({ content: '', error: 'Country name is required' });
  }

  if (!year || year.trim() === '') {
    return res.status(400).json({ content: '', error: 'Year is required' });
  }

  // Create cache key
  const cacheKey = `ai:${countryName.toLowerCase().replace(/\s+/g, '_')}:${year}`;
  
  try {
    // Try to get cached response first
    const cachedResponse = await redisCache.get<string>(cacheKey);
    if (cachedResponse) {
      console.log('Cache hit for AI request:', {
        countryName,
        year,
        cacheKey,
        timestamp: new Date().toISOString(),
      });

      // Track cache hit
      ReactGA4.event('ai_cache_hit', {
        country_name: countryName,
        year: year,
        cache_key: cacheKey,
        performance_benefit: 'cache_served'
      });

      return res.status(200).json({ content: cachedResponse });
    }

    console.log('Cache miss for AI request:', {
      countryName,
      year,
      cacheKey,
      timestamp: new Date().toISOString(),
    });

    // Track cache miss
    ReactGA4.event('ai_cache_miss', {
      country_name: countryName,
      year: year,
      cache_key: cacheKey,
      cache_status: 'miss'
    });
  } catch (cacheError) {
    console.warn('Redis cache error (continuing without cache):', {
      countryName,
      year,
      cacheKey,
      error: cacheError instanceof Error ? cacheError.message : 'Unknown cache error',
      timestamp: new Date().toISOString(),
    });

    // Track cache error
    ReactGA4.event('ai_cache_error', {
      country_name: countryName,
      year: year,
      error_type: 'cache_operation_failed',
      error_message: cacheError instanceof Error ? cacheError.message : 'unknown_cache_error'
    });
  }

  // Check API key (now server-side only)
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

  // If no API key is provided, return error message
  if (!GEMINI_API_KEY) {
    console.log('No Gemini API key provided', {
      countryName,
      year,
      timestamp: new Date().toISOString(),
    });

    // Track missing API key
    ReactGA4.event('ai_api_key_missing', {
      country_name: countryName,
      year: year,
      error_type: 'configuration_error',
      service: 'gemini_api'
    });

    return res.status(500).json({ 
      content: '', 
      error: 'AI information requires Gemini API key setup. Please check the README or switch to Wikipedia.' 
    });
  }

  // Track AI request initiation
  ReactGA4.event('ai_api_request_start', {
    country_name: countryName,
    year: year,
    api_service: 'gemini',
    request_type: 'historical_information'
  });

  try {
    // Create a focused prompt for Gemini
    const prompt = generateHistoricalPrompt(countryName, year);

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
          maxOutputTokens: 150,
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
        countryName,
        year,
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
        ReactGA4.event('ai_quota_exceeded', {
          country_name: countryName,
          year: year,
          error_type: 'rate_limit',
          response_time_ms: Math.round(responseTime),
          retry_delay: retryDelay || 'unknown'
        });

        if (quotaExceeded) {
          const retryMessage = retryDelay ? ` (retry after ${retryDelay})` : '';
          return res.status(429).json({ 
            content: '', 
            error: `AI service has reached its daily quota limit${retryMessage}. Please try again tomorrow or switch to Wikipedia for historical information.` 
          });
        }
      }

      // Track API error
      ReactGA4.event('ai_api_error', {
        country_name: countryName,
        year: year,
        error_code: response.status,
        error_type: response.status === 404 ? 'not_found' : 
                   response.status === 500 ? 'server_error' : 
                   response.status === 429 ? 'rate_limit' : 'http_error',
        response_time_ms: Math.round(responseTime)
      });

      return res.status(response.status).json({ 
        content: '', 
        error: `HTTP error! status: ${response.status} - ${response.statusText}` 
      });
    }

    const data = await response.json();
    
    console.log('Gemini API response:', {
      countryName,
      year,
      responseType: typeof data,
      hasContent: !!data.candidates,
      timestamp: new Date().toISOString(),
    });
    
    // Handle Gemini API response format
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      const content = data.candidates[0].content.parts[0].text || '';
      
      console.log('AI text processing:', {
        countryName,
        year,
        contentLength: content.length,
        timestamp: new Date().toISOString(),
      });

      const trimmedContent = content.trim();
      
      if (trimmedContent) {
        // Cache the successful response ONLY - we never cache error responses
        // This ensures only valid AI content is served from cache
        try {
          await redisCache.set(cacheKey, trimmedContent, CACHE_TTL);
          console.log('Successfully cached AI response:', {
            countryName,
            year,
            cacheKey,
            ttl: CACHE_TTL,
            contentLength: trimmedContent.length,
            timestamp: new Date().toISOString(),
          });

          // Track successful cache write
          ReactGA4.event('ai_cache_write_success', {
            country_name: countryName,
            year: year,
            cache_key: cacheKey,
            content_length: trimmedContent.length,
            cache_ttl: CACHE_TTL
          });
        } catch (cacheWriteError) {
          console.warn('Failed to cache AI response (continuing normally):', {
            countryName,
            year,
            cacheKey,
            error: cacheWriteError instanceof Error ? cacheWriteError.message : 'Unknown cache write error',
            timestamp: new Date().toISOString(),
          });

          // Track cache write error
          ReactGA4.event('ai_cache_write_error', {
            country_name: countryName,
            year: year,
            error_type: 'cache_write_failed',
            error_message: cacheWriteError instanceof Error ? cacheWriteError.message : 'unknown_error'
          });
        }

        // Track successful AI response with comprehensive metrics
        const wordCount = trimmedContent.split(/\s+/).length;
        ReactGA4.event('ai_content_generated_api', {
          country_name: countryName,
          year: year,
          content_length: trimmedContent.length,
          word_count: wordCount,
          response_time_ms: Math.round(responseTime),
          content_quality: wordCount < 50 ? 'short' : wordCount < 150 ? 'medium' : 'detailed',
          api_service: 'gemini'
        });

        return res.status(200).json({ content: trimmedContent });
      } else {
        // Track empty response
        ReactGA4.event('ai_empty_response_api', {
          country_name: countryName,
          year: year,
          response_time_ms: Math.round(responseTime),
          api_service: 'gemini'
        });

        return res.status(200).json({ 
          content: 'AI generated empty response. Please try again or switch to Wikipedia.' 
        });
      }
    }

    console.warn('Unexpected API response format:', {
      countryName,
      year,
      responseData: data,
      timestamp: new Date().toISOString(),
    });

    // Track unexpected response format
    ReactGA4.event('ai_response_format_error', {
      country_name: countryName,
      year: year,
      error_type: 'unexpected_format',
      api_service: 'gemini'
    });
    
    return res.status(200).json({ 
      content: 'AI returned unexpected response format. Please try again or switch to Wikipedia.' 
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('Gemini API error:', error);
    console.error('Error details:', {
      countryName,
      year,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Determine error type and provide appropriate message
    let errorMessage = 'Something went wrong with AI information. Please try again or switch to Wikipedia.';
    
    if (error instanceof Error) {
      // Check if it's a quota/rate limit error
      if (error.message.includes('429')) {
        errorMessage = 'AI service quota exceeded. Please try again later or switch to Wikipedia for historical information.';
      }
      // Check if it's a network error
      else if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      }
      // Check if it's an API key error
      else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'AI service authentication issue. Please check API key configuration.';
      }
      // Check if it's a timeout error
      else if (error.message.includes('timeout') || error.message.includes('AbortError')) {
        errorMessage = 'AI service request timed out. Please try again or switch to Wikipedia.';
      }
    }

    // Track request failure
    ReactGA4.event('ai_api_request_failed', {
      country_name: countryName,
      year: year,
      error_type: error instanceof Error && error.message.includes('429') ? 'quota_exceeded' :
                 error instanceof Error && error.message.includes('fetch') ? 'network_error' :
                 error instanceof Error && error.message.includes('401') ? 'authentication_error' :
                 error instanceof Error && error.message.includes('timeout') ? 'timeout_error' : 'unknown_error',
      error_name: error instanceof Error ? error.name : 'UnknownError',
      response_time_ms: Math.round(responseTime),
      api_service: 'gemini'
    });
    
    // Return specific error message instead of generic fallback
    return res.status(500).json({ content: '', error: errorMessage });
  }
} 