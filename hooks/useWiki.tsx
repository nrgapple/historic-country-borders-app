import useSWR, { Fetcher } from 'swr';

interface WikiApiResponse {
  content: string;
  error?: string;
}

const fetcher: Fetcher<string, string> = async (title: string) => {
  // Validate title input
  if (!title || title.trim() === '') {
    return 'Not Found';
  }

  try {
    const response = await fetch('/api/wikipedia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: title.trim(),
      }),
    });

    if (!response.ok) {
      const errorData: WikiApiResponse = await response.json().catch(() => ({ 
        content: '', 
        error: 'Failed to parse error response' 
      }));

      console.error('Wikipedia API HTTP error:', {
        status: response.status,
        statusText: response.statusText,
        title,
        errorMessage: errorData.error,
        timestamp: new Date().toISOString(),
      });

      return errorData.error || `HTTP error! status: ${response.status} - ${response.statusText}`;
    }

    const data: WikiApiResponse = await response.json();
    
    console.log('Wikipedia API response:', {
      title,
      responseType: typeof data,
      hasContent: !!data.content,
      timestamp: new Date().toISOString(),
    });

    return data.content || 'Not Found';
  } catch (error) {
    console.error('Wikipedia API error:', {
      title,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    // Determine error type and provide appropriate message
    let errorMessage = 'Unable to load Wikipedia information';
    
    if (error instanceof Error) {
      // Check if it's a network error
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      }
      // Check if it's a timeout error
      else if (error.message.includes('timeout') || error.message.includes('AbortError')) {
        errorMessage = 'Wikipedia request timed out. Please try again.';
      }
    }
    
    return errorMessage;
  }
};

export const useWikiData = (name: string) => {
  const { data, error } = useSWR(`wiki:${name}`, () => fetcher(name), {
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
