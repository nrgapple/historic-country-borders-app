import { createContext, ReactNode, useContext, useState } from 'react';
import { Updater, useImmer } from 'use-immer';

export interface State {
  hide: boolean;
}

export interface StateContext {
  state: State;
  set: Updater<State>;
}

const context = createContext({} as StateContext);

export const useAppState = () => {
  const values = useContext(context);
  return values;
};

export const useAppStateValue = <T extends keyof State>(key: T) => {
  const values = useContext(context);
  return values.state[key] as State[T];
};

export const useAppStateSetter = () => {
  const { set } = useContext(context);
  return set;
};

export const StateProvider = ({ children }: { children: ReactNode }) => {
  const [get, stateSet] = useImmer<State>({} as State);

  return (
    <context.Provider value={{ state: get, set: stateSet }}>
      {children}
    </context.Provider>
  );
};
