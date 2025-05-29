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
      ReactGA4.event({
        category: 'AI Compare',
        action: 'cache_hit',
        label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
        value: 1,
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
    ReactGA4.event({
      category: 'AI Compare',
      action: 'cache_miss',
      label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
      value: 1,
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
    ReactGA4.event({
      category: 'AI Compare',
      action: 'cache_error',
      label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
      value: 1,
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
    ReactGA4.event({
      category: 'AI Compare',
      action: 'api_key_missing',
      label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
      value: 1,
    });

    return res.status(500).json({ 
      content: '', 
      error: 'AI comparison requires Gemini API key setup. Please check the README.' 
    });
  }

  // Track AI compare request initiation
  ReactGA4.event({
    category: 'AI Compare',
    action: 'request_initiated',
    label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
    value: 1,
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
        ReactGA4.event({
          category: 'AI Compare',
          action: 'quota_exceeded',
          label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
          value: 1,
        });

        // Track response time for quota exceeded requests
        ReactGA4.event({
          category: 'AI Compare',
          action: 'response_time_quota_exceeded',
          label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
          value: Math.round(responseTime),
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
      ReactGA4.event({
        category: 'AI Compare',
        action: 'api_error',
        label: `${response.status}_${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
        value: response.status,
      });

      // Track response time for failed requests
      ReactGA4.event({
        category: 'AI Compare',
        action: 'response_time_error',
        label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
        value: Math.round(responseTime),
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
          ReactGA4.event({
            category: 'AI Compare',
            action: 'cache_write_success',
            label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
            value: 1,
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
          ReactGA4.event({
            category: 'AI Compare',
            action: 'cache_write_error',
            label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
            value: 1,
          });
        }

        // Track successful AI compare response
        ReactGA4.event({
          category: 'AI Compare',
          action: 'response_success',
          label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
          value: 1,
        });

        // Track response time for successful requests
        ReactGA4.event({
          category: 'AI Compare',
          action: 'response_time_success',
          label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
          value: Math.round(responseTime),
        });

        // Track response quality metrics
        ReactGA4.event({
          category: 'AI Compare',
          action: 'response_length',
          label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
          value: trimmedContent.length,
        });

        // Track word count for content analysis
        const wordCount = trimmedContent.split(/\s+/).length;
        ReactGA4.event({
          category: 'AI Compare',
          action: 'response_word_count',
          label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
          value: wordCount,
        });

        return res.status(200).json({ content: trimmedContent });
      } else {
        // Track empty response
        ReactGA4.event({
          category: 'AI Compare',
          action: 'response_empty',
          label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
          value: 1,
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
    ReactGA4.event({
      category: 'AI Compare',
      action: 'response_format_error',
      label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
      value: 1,
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

    // Determine error type and provide appropriate message
    let errorMessage = 'Something went wrong with AI comparison. Please try again.';
    
    if (error instanceof Error) {
      // Check if it's a quota/rate limit error
      if (error.message.includes('429')) {
        errorMessage = 'AI service quota exceeded. Please try again later.';
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
        errorMessage = 'AI service request timed out. Please try again.';
      }
    }

    // Track request failure
    ReactGA4.event({
      category: 'AI Compare',
      action: 'request_failed',
      label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
      value: 1,
    });

    // Track error type
    const errorType = error instanceof Error ? error.name : 'UnknownError';
    ReactGA4.event({
      category: 'AI Compare',
      action: 'error_type',
      label: `${errorType}_${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
      value: 1,
    });

    // Track response time for failed requests
    ReactGA4.event({
      category: 'AI Compare',
      action: 'response_time_failed',
      label: `${country1.name}_${country1.year}_vs_${country2.name}_${country2.year}`,
      value: Math.round(responseTime),
    });
    
    // Return specific error message instead of generic fallback
    return res.status(500).json({ content: '', error: errorMessage });
  }
} 