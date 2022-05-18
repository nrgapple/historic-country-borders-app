import { useRouter } from 'next/router';
import { ParsedUrlQuery } from 'querystring';
import { createContext, ReactNode, useCallback, useContext } from 'react';
import { useDebounce, useEffectOnce } from 'react-use';
import useMap from './useMap';

export interface QueryContext {
  query: ParsedUrlQuery;
  setQuery: (query: ParsedUrlQuery) => void;
}

const context = createContext({} as QueryContext);

export const useQuery = (onlyOnMount: boolean = false) => {
  const { query, setQuery } = useContext(context);
  return { query, setQuery } as QueryContext;
};

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  const { query, push } = useRouter();
  const [queries, queriesActions] = useMap();

  useEffectOnce(() => {
    queriesActions.setAll(Object.entries(query));
  });

  const set = useCallback(
    (query: ParsedUrlQuery) => {
      Object.entries(query).forEach((q) => queriesActions.set(...q));
    },
    [query],
  );

  useDebounce(
    () => {
      if (queries) {
        push({
          query: Object.fromEntries(queries),
        });
      }
    },
    200,
    [queries],
  );

  return (
    <context.Provider value={{ query: query, setQuery: set }}>
      {children}
    </context.Provider>
  );
};
