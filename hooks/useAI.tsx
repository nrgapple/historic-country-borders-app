import useSWR, { Fetcher } from 'swr';

// Google Gemini API - generous free tier (60 requests/minute, no credit card required)
// Get your free API key at: https://ai.google.dev/gemini-api/docs/api-key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

interface FetcherProps {
  countryName: string;
  year: string;
}

const fetcher: Fetcher<string, FetcherProps> = async ({ countryName, year }: FetcherProps) => {
  if (!countryName || countryName.trim() === '') {
    return 'Not Found';
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
    return 'AI information requires Gemini API key setup. Please check the README or switch to Wikipedia.';
  }

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
      
      return content.trim() || 'AI generated empty response. Please try again or switch to Wikipedia.';
    }

    console.warn('Unexpected API response format:', {
      countryName,
      year,
      responseData: data,
      timestamp: new Date().toISOString(),
    });
    
    return 'AI returned unexpected response format. Please try again or switch to Wikipedia.';
  } catch (error) {
    console.error('Gemini API error:', error);
    console.error('Error details:', {
      countryName,
      year,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    // Return error message instead of fallback
    return 'Something went wrong with AI information. Please try again or switch to Wikipedia.';
  }
};

export const useAIData = (name: string, year: string = new Date().getFullYear().toString()) => {
  const { data, error } = useSWR(`ai:${name}:${year}`, () => fetcher({ countryName: name, year }), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000, // 5 minutes
  });

  console.log('useAIData - Name:', name, 'Year:', year, 'Data:', data, 'Loading:', !error && !data);

  return {
    title: name,
    info: data || 'Not Found',
    isLoading: !error && !data,
    isError: error,
  } as const;
}; 