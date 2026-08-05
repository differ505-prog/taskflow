"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

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
        // 2) 主動抓新版（不等 setInterval 第一次 1 小時）
        reg.update();
      })
      .catch(() => {
        // SW registration failed — app still works
      });

    // 3) 切前景時主動檢查更新（§24.1 + §26 K）
    // iOS PWA 進背景會凍結 setInterval、Wed；bulb by visibilitychange 來取代週期輪詢
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerUpdate();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // 4) online 事件 — 從離線恢復也檢查一次
    const onOnline = () => triggerUpdate();
    window.addEventListener("online", onOnline);

    // 5) 自動更新機制：當新的 Service Worker 接管時，自動重新載入網頁以套用新版
    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        // 如果網頁在背景，不強制干擾，等用戶切回前景時自然會看到新版
        if (document.visibilityState === "visible") {
          window.location.reload();
        }
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
