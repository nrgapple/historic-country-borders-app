import { useState, useEffect } from 'react';

export const useWikiData = (name: string) => {
  const [data, setData] = useState('');

  const fetchData = async (title: string) => {
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
    );
    if (resp.ok) {
      const info = await resp.json();
      const bit = info.extract;
      return bit;
    }
    return 'Not Found';
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
  return data;
};
