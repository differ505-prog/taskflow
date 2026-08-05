"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // 0) 緊急逃生開關：如果 URL 帶有 ?killsw=1，則強制註銷所有 SW 並重整
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("killsw") === "1") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let reg of registrations) {
          reg.unregister();
        }
        window.location.href = "/";
      });
      return;
    }

    const triggerUpdate = () => {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => reg?.update())
        .catch(() => {
          // update() 失敗不致命，下次再試
        });
    };

    // 1) 初始註冊
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // 2) 主動抓新版
        reg.update();
      })
      .catch(() => {
        // SW registration failed
      });

    // 3) 切前景時主動檢查更新
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerUpdate();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // 4) online 事件 — 從離線恢復也檢查一次
    const onOnline = () => triggerUpdate();
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
