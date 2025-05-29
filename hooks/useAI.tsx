import useSWR, { Fetcher } from 'swr';
import ReactGA4 from 'react-ga4';

interface FetcherProps {
  countryName: string;
  year: string;
}

interface AIApiResponse {
  content: string;
  error?: string;
}

const fetcher: Fetcher<string, FetcherProps> = async ({ countryName, year }: FetcherProps) => {
  const startTime = Date.now();
  
  if (!countryName || countryName.trim() === '') {
    return 'Not Found';
  }

  // Track AI request initiation
  ReactGA4.event('ai_content_request', {
    country_name: countryName,
    year: year,
    request_type: 'country_information'
  });

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        countryName,
        year,
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData: AIApiResponse = await response.json().catch(() => ({ 
        content: '', 
        error: 'Failed to parse error response' 
      }));

      console.error('AI API HTTP error:', {
        status: response.status,
        statusText: response.statusText,
        countryName,
        year,
        errorMessage: errorData.error,
        timestamp: new Date().toISOString(),
      });

      // Handle specific error types
      if (response.status === 429) {
        // Track quota exceeded
        ReactGA4.event('ai_quota_exceeded', {
          country_name: countryName,
          year: year,
          error_type: 'rate_limit',
          response_time_ms: Math.round(responseTime)
        });
      }

      // Track API error
      ReactGA4.event('ai_request_error', {
        country_name: countryName,
        year: year,
        error_code: response.status,
        error_type: response.status === 404 ? 'not_found' : 
                   response.status === 500 ? 'server_error' : 
                   response.status === 429 ? 'rate_limit' : 'http_error',
        response_time_ms: Math.round(responseTime)
      });

      // Return the error message from the API
      return errorData.error || `HTTP error! status: ${response.status} - ${response.statusText}`;
    }

    const data: AIApiResponse = await response.json();
    
    console.log('AI API response:', {
      countryName,
      year,
      responseType: typeof data,
      hasContent: !!data.content,
      timestamp: new Date().toISOString(),
    });

    const content = data.content?.trim() || '';
    
    if (content) {
      // Track successful AI response
      const wordCount = content.split(/\s+/).length;
      
      ReactGA4.event('ai_content_generated', {
        country_name: countryName,
        year: year,
        content_length: content.length,
        word_count: wordCount,
        response_time_ms: Math.round(responseTime),
        content_quality: wordCount < 50 ? 'short' : wordCount < 200 ? 'medium' : 'detailed'
      });

      return content;
    } else {
      // Track empty response
      ReactGA4.event('ai_empty_response', {
        country_name: countryName,
        year: year,
        response_time_ms: Math.round(responseTime),
        error_message: data.error || 'empty_content'
      });

      return data.error || 'AI generated empty response. Please try again or switch to Wikipedia.';
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('AI API error:', error);
    console.error('Error details:', {
      countryName,
      year,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Determine error type and provide appropriate message
    let errorMessage = 'Something went wrong with AI information. Please try again or switch to Wikipedia.';
    let errorType = 'unknown_error';
    
    if (error instanceof Error) {
      // Check if it's a network error
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
        errorType = 'network_error';
      }
      // Check if it's a timeout error
      else if (error.message.includes('timeout') || error.message.includes('AbortError')) {
        errorMessage = 'AI service request timed out. Please try again or switch to Wikipedia.';
        errorType = 'timeout_error';
      }
    }

    // Track request failure with detailed error information
    ReactGA4.event('ai_request_failed', {
      country_name: countryName,
      year: year,
      error_type: errorType,
      error_name: error instanceof Error ? error.name : 'UnknownError',
      response_time_ms: Math.round(responseTime),
      network_related: errorType.includes('network') || errorType.includes('timeout')
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