import type { NextApiRequest, NextApiResponse } from 'next';
import wiki from 'wikijs';

interface WikiRequest {
  name: string;
}

interface WikiResponse {
  content: string;
  error?: string;
}

const fetcher = async (title: string): Promise<string> => {
  // Validate title input
  if (!title || title.trim() === '') {
    return 'Not Found';
  }

  const cleanTitle = title.trim();
  
  try {
    // First try wikijs with proper configuration
    const wikiInstance = wiki({
      apiUrl: 'https://en.wikipedia.org/w/api.php',
      headers: {
        'User-Agent': 'HistoricCountryBordersApp/1.0 (https://github.com/user/repo)'
      }
    });

    // Use the search method to find the best match (supports fuzzy search)
    const searchResults = await wikiInstance.search(cleanTitle, 1);
    
    if (searchResults && searchResults.results && searchResults.results.length > 0) {
      const bestMatch = searchResults.results[0];
      const page = await wikiInstance.page(bestMatch);
      const summary = await page.summary();
      
      if (summary && summary.trim()) {
        // Truncate to reasonable length if too long
        if (summary.length > 500) {
          return summary.substring(0, 500) + '...';
        }
        return summary;
      }
    }
    
    // If no search results, try direct page lookup
    const page = await wikiInstance.page(cleanTitle);
    const summary = await page.summary();
    
    if (summary && summary.trim()) {
      if (summary.length > 500) {
        return summary.substring(0, 500) + '...';
      }
      return summary;
    }
    
    return 'Not Found';
  } catch (wikiError) {
    console.warn('WikiJS error, falling back to direct API:', {
      title: cleanTitle,
      error: wikiError instanceof Error ? wikiError.message : 'Unknown wikijs error',
      timestamp: new Date().toISOString(),
    });

    // Fallback to direct Wikipedia API with CORS support
    try {
      // Use Wikipedia's opensearch API for fuzzy search
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanTitle)}&limit=1&namespace=0&format=json&origin=*`;
      const searchResp = await fetch(searchUrl);
      
      if (!searchResp.ok) {
        throw new Error(`Search failed: ${searchResp.status}`);
      }
      
      const searchData = await searchResp.json();
      
      // opensearch returns [query, titles, descriptions, urls]
      if (!searchData[1] || searchData[1].length === 0) {
        return 'Not Found';
      }
      
      const foundTitle = searchData[1][0];
      
      // Get the page extract using the page API
      const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(foundTitle)}&prop=extracts&exintro=1&explaintext=1&exsectionformat=plain&origin=*`;
      const pageResp = await fetch(pageUrl);
      
      if (!pageResp.ok) {
        throw new Error(`Page fetch failed: ${pageResp.status}`);
      }
      
      const pageData = await pageResp.json();
      
      if (pageData.query && pageData.query.pages) {
        const pages = Object.values(pageData.query.pages) as any[];
        if (pages.length > 0 && pages[0].extract) {
          const extract = pages[0].extract;
          if (extract.length > 500) {
            return extract.substring(0, 500) + '...';
          }
          return extract;
        }
      }
      
      return 'Not Found';
    } catch (fallbackError) {
      console.error('Wikipedia fallback also failed:', {
        title: cleanTitle,
        error: fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error',
        timestamp: new Date().toISOString(),
      });
      
      return 'Unable to load Wikipedia information';
    }
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WikiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ content: '', error: 'Method not allowed' });
  }

  const { name }: WikiRequest = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ content: '', error: 'Name is required' });
  }

  try {
    const content = await fetcher(name);
    return res.status(200).json({ content });
  } catch (error) {
    console.error('Wikipedia API error:', {
      name,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({ 
      content: '', 
      error: 'Failed to fetch Wikipedia information' 
    });
  }
} 