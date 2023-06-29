import { useState, useEffect } from 'react';
import wiki from 'wikijs';

export const useWikiData = (name: string) => {
  const [data, setData] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async (title: string) => {
    setIsLoading(true);
    try {
      const wikiResp = await wiki({
        apiUrl: 'https://en.wikipedia.org/w/api.php',
      }).find(title);
      return wikiResp.summary();
    } catch (err) {
      console.error(err);

      // Fallback to REST API
      const resp = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
      );
      if (resp.ok) {
        const info = await resp.json();
        const bit = info.extract;
        return bit;
      }
      return 'Not Found';
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (name) {
      (async () => {
        setData(await fetchData(name));
      })();
    } else {
      setData('Not Found');
    }
  }, [name]);
  return { title: name, info: data, isLoading } as const;
};
