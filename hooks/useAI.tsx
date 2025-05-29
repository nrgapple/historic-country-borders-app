import useSWR, { Fetcher } from 'swr';
import ReactGA4 from 'react-ga4';
import { redisCache } from '../lib/redis';

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

interface FetcherProps {
  countryName: string;
  year: string;
}

const fetcher: Fetcher<string, FetcherProps> = async ({ countryName, year }: FetcherProps) => {
  const startTime = Date.now();
  
  if (!countryName || countryName.trim() === '') {
    return 'Not Found';
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
      ReactGA4.event({
        category: 'AI Feature',
        action: 'cache_hit',
        label: `${countryName}_${year}`,
        value: 1,
      });

      return cachedResponse;
    }

    console.log('Cache miss for AI request:', {
      countryName,
      year,
      cacheKey,
      timestamp: new Date().toISOString(),
    });

    // Track cache miss
    ReactGA4.event({
      category: 'AI Feature',
      action: 'cache_miss',
      label: `${countryName}_${year}`,
      value: 1,
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
    ReactGA4.event({
      category: 'AI Feature',
      action: 'cache_error',
      label: `${countryName}_${year}`,
      value: 1,
    });
  }

  // Check API key dynamically for better testability
  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

  // If no API key is provided, return error message
  if (!GEMINI_API_KEY) {
    console.log('No Gemini API key provided', {
      countryName,
      year,
      timestamp: new Date().toISOString(),
    });

    // Track missing API key
    ReactGA4.event({
      category: 'AI Feature',
      action: 'api_key_missing',
      label: `${countryName}_${year}`,
      value: 1,
    });

    return 'AI information requires Gemini API key setup. Please check the README or switch to Wikipedia.';
  }

  // Track AI request initiation
  ReactGA4.event({
    category: 'AI Feature',
    action: 'request_initiated',
    label: `${countryName}_${year}`,
    value: 1,
  });

  try {
    // Create a focused prompt for Gemini
    const prompt = `Write a brief, informative paragraph about ${countryName} as it existed in the year ${year}. Include its location, capital city (if applicable for that time period), and 2-3 interesting facts about its culture, history, or geography relevant to that era. Keep it under 100 words and make it engaging. If the territory didn't exist as a unified entity in ${year}, describe what was there instead.`;

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
        ReactGA4.event({
          category: 'AI Feature',
          action: 'quota_exceeded',
          label: `${countryName}_${year}`,
          value: 1,
        });

        // Track response time for quota exceeded requests
        ReactGA4.event({
          category: 'AI Feature',
          action: 'response_time_quota_exceeded',
          label: `${countryName}_${year}`,
          value: Math.round(responseTime),
        });

        if (quotaExceeded) {
          const retryMessage = retryDelay ? ` (retry after ${retryDelay})` : '';
          return `AI service has reached its daily quota limit${retryMessage}. Please try again tomorrow or switch to Wikipedia for historical information.`;
        }
      }

      // Track API error
      ReactGA4.event({
        category: 'AI Feature',
        action: 'api_error',
        label: `${response.status}_${countryName}_${year}`,
        value: response.status,
      });

      // Track response time for failed requests
      ReactGA4.event({
        category: 'AI Feature',
        action: 'response_time_error',
        label: `${countryName}_${year}`,
        value: Math.round(responseTime),
      });

      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
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
          ReactGA4.event({
            category: 'AI Feature',
            action: 'cache_write_success',
            label: `${countryName}_${year}`,
            value: 1,
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
          ReactGA4.event({
            category: 'AI Feature',
            action: 'cache_write_error',
            label: `${countryName}_${year}`,
            value: 1,
          });
        }

        // Track successful AI response
        ReactGA4.event({
          category: 'AI Feature',
          action: 'response_success',
          label: `${countryName}_${year}`,
          value: 1,
        });

        // Track response time for successful requests
        ReactGA4.event({
          category: 'AI Feature',
          action: 'response_time_success',
          label: `${countryName}_${year}`,
          value: Math.round(responseTime),
        });

        // Track response quality metrics
        ReactGA4.event({
          category: 'AI Feature',
          action: 'response_length',
          label: `${countryName}_${year}`,
          value: trimmedContent.length,
        });

        // Track word count for content analysis
        const wordCount = trimmedContent.split(/\s+/).length;
        ReactGA4.event({
          category: 'AI Feature',
          action: 'response_word_count',
          label: `${countryName}_${year}`,
          value: wordCount,
        });

        return trimmedContent;
      } else {
        // Track empty response
        ReactGA4.event({
          category: 'AI Feature',
          action: 'response_empty',
          label: `${countryName}_${year}`,
          value: 1,
        });

        return 'AI generated empty response. Please try again or switch to Wikipedia.';
      }
    }

    console.warn('Unexpected API response format:', {
      countryName,
      year,
      responseData: data,
      timestamp: new Date().toISOString(),
    });

    // Track unexpected response format
    ReactGA4.event({
      category: 'AI Feature',
      action: 'response_format_error',
      label: `${countryName}_${year}`,
      value: 1,
    });
    
    return 'AI returned unexpected response format. Please try again or switch to Wikipedia.';
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
    ReactGA4.event({
      category: 'AI Feature',
      action: 'request_failed',
      label: `${countryName}_${year}`,
      value: 1,
    });

    // Track error type
    const errorType = error instanceof Error ? error.name : 'UnknownError';
    ReactGA4.event({
      category: 'AI Feature',
      action: 'error_type',
      label: `${errorType}_${countryName}_${year}`,
      value: 1,
    });

    // Track response time for failed requests
    ReactGA4.event({
      category: 'AI Feature',
      action: 'response_time_failed',
      label: `${countryName}_${year}`,
      value: Math.round(responseTime),
    });
    
    // Return specific error message instead of generic fallback
    return errorMessage;
  }
};

export const useAIData = (name: string, year: string = new Date().getFullYear().toString()) => {
  const { data, error } = useSWR(`ai:${name}:${year}`, () => fetcher({ countryName: name, year }), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000, // 5 minutes
  });

  return {
    title: name,
    info: data || 'Not Found',
    isLoading: !error && !data,
    isError: error,
  } as const;
}; 