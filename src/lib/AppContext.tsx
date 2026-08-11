// AppContext — 純 re-export 薄層
// 所有實作見 AppContextInternal/provider.tsx
// 消費者（60+ components）完全不需改動
export { AppProvider, useApp } from "./AppContextInternal/provider";
export type { AppContextValue } from "./AppContextInternal/types";
