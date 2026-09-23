/**
 * AppRouterProvider — 抽出 AppContextInternal 的路由視圖 state。
 * 職責：currentView / currentListId / currentSharedListId / searchQuery / activeFilter
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { AppView, TaskFilter } from "@/lib/types";

interface AppRouterContextValue {
  currentView: AppView;
  setCurrentViewState: (v: AppView) => void;
  currentListId: string | undefined;
  setCurrentListId: (id: string | undefined) => void;
  currentSharedListId: string | undefined;
  setCurrentSharedListIdState: (id: string | undefined) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeFilter: TaskFilter;
  setActiveFilter: (f: TaskFilter) => void;
}

const AppRouterContext = createContext<AppRouterContextValue | null>(null);

export { AppRouterContext };

export function AppRouterProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentViewState] = useState<AppView>("inbox");
  const [currentListId, setCurrentListId] = useState<string | undefined>(undefined);
  const [currentSharedListId, setCurrentSharedListIdState] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TaskFilter>({});

  return (
    <AppRouterContext.Provider
      value={{
        currentView,
        setCurrentViewState,
        currentListId,
        setCurrentListId,
        currentSharedListId,
        setCurrentSharedListIdState,
        searchQuery,
        setSearchQuery,
        activeFilter,
        setActiveFilter,
      }}
    >
      {children}
    </AppRouterContext.Provider>
  );
}

export function useAppRouter(): AppRouterContextValue {
  const ctx = useContext(AppRouterContext);
  if (!ctx) {
    throw new Error("useAppRouter must be used within AppRouterProvider");
  }
  return ctx;
}
