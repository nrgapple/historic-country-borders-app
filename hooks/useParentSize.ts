import { useState, useEffect, useCallback } from 'react';

export const useParentSize = (parentRef: React.RefObject<HTMLDivElement>) => {
  const [height, setHeight] = useState<number>();
  const [width, setWdith] = useState<number>();
  const [reset, setReset] = useState(false);

  const set = useCallback(() => {
    if (parentRef.current) {
      setHeight(parentRef.current.offsetHeight);
      setWdith(parentRef.current.offsetWidth);
    }
  }, [parentRef]);

  const refresh = () => {
    setHeight(1);
    setWdith(1);
    setReset(true);
  };

  useEffect(() => {
    if (reset && height === 1 && width === 1) {
      setReset(false);
      setTimeout(() => {
        set();
      }, 100);
    }
  }, [reset, height, width]);

  useEffect(() => {
    set();
  }, [parentRef]);

  return { height, width, refresh } as const;
};
