"use client";

import { useEffect } from "react";

export function BfcacheHandler() {
  useEffect(() => {
    const handlePageshow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageshow);
    return () => window.removeEventListener("pageshow", handlePageshow);
  }, []);

  return null;
}
