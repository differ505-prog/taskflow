"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const BfcacheContext = createContext<() => number>(() => 0);

export function useBfcacheKey() {
  return useContext(BfcacheContext);
}

export function BfcacheHandler({ children }: { children?: React.ReactNode }) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const handlePageshow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        sessionStorage.setItem("bfcache_restored", Date.now().toString());
        window.location.reload();
      } else if (sessionStorage.getItem("bfcache_restored")) {
        sessionStorage.removeItem("bfcache_restored");
        setKey((k) => k + 1);
      }
    };
    window.addEventListener("pageshow", handlePageshow);
    return () => window.removeEventListener("pageshow", handlePageshow);
  }, []);

  return (
    <BfcacheContext.Provider value={useCallback(() => key, [key])}>
      {children}
    </BfcacheContext.Provider>
  );
}
