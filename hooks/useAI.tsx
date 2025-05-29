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
  ReactGA4.event({
    category: 'AI Feature',
    action: 'request_initiated',
    label: `${countryName}_${year}`,
    value: 1,
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
        value: content.length,
      });

      // Track word count for content analysis
      const wordCount = content.split(/\s+/).length;
      ReactGA4.event({
        category: 'AI Feature',
        action: 'response_word_count',
        label: `${countryName}_${year}`,
        value: wordCount,
      });

      return content;
    } else {
      // Track empty response
      ReactGA4.event({
        category: 'AI Feature',
        action: 'response_empty',
        label: `${countryName}_${year}`,
        value: 1,
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
    
    if (error instanceof Error) {
      // Check if it's a network error
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
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