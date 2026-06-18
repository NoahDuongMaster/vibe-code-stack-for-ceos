import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { type StoreApi, useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

type GlobalState = {
  theme: 'dark' | 'light';
};

type GlobalActions = {
  // eslint-disable-next-line no-unused-vars
  setTheme: (theme: 'dark' | 'light') => void;
};

type GlobalStore = GlobalState & GlobalActions;

const defaultInitState: GlobalState = {
  theme: 'light',
};

const createGlobalStore = (initState: GlobalState = defaultInitState) => {
  return createStore<GlobalStore>()((set) => ({
    ...initState,
    setTheme: (theme: 'light' | 'dark') => {
      const body = document.body;

      if (theme === 'dark') {
        if (!body.hasAttribute('theme-mode')) {
          body.setAttribute('theme-mode', 'dark');
        }
      } else {
        if (body.hasAttribute('theme-mode')) {
          body.removeAttribute('theme-mode');
        }
      }
      return set({ theme });
    },
  }));
};

interface GlobalStoreProviderProps {
  children: ReactNode;
}

const GlobalStoreContext = createContext<StoreApi<GlobalStore> | null>(null);

const GlobalStoreProvider = ({ children }: GlobalStoreProviderProps) => {
  const storeRef = useRef<StoreApi<GlobalStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createGlobalStore();
  }

  useEffect(() => {
    function matchMode(e: MediaQueryListEvent) {
      if (!storeRef.current) return;
      storeRef.current.setState({ theme: e.matches ? 'dark' : 'light' });
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (!localStorage.getItem('theme')) {
      mql.addEventListener('change', matchMode);
    }

    const systemTheme = mql.matches ? 'dark' : 'light';
    const userTheme = localStorage.getItem('theme') as GlobalState['theme'];
    storeRef.current?.setState({ theme: userTheme || systemTheme });

    return () => {
      mql.removeEventListener('change', matchMode);
    };
  }, []);

  return (
    <GlobalStoreContext.Provider value={storeRef.current}>
      {children}
    </GlobalStoreContext.Provider>
  );
};

// eslint-disable-next-line no-unused-vars
const useGlobalStore = <T,>(selector: (store: GlobalStore) => T): T => {
  const globalStoreContext = useContext(GlobalStoreContext);

  if (!globalStoreContext) {
    throw new Error(`globalStore must be use within GlobalStoreProvider`);
  }

  return useStore(globalStoreContext, selector);
};

export { GlobalStoreProvider, useGlobalStore };
