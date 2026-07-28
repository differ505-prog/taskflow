"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/lib/AppContext";
import { DEFAULT_LIST_IDS } from "@/lib/types";

/**
 * 首次載入偵測：當使用者任務清單為空時,塞入一筆 PWA 安裝教學任務。
 *
 * 觸發條件（全部 AND）：
 *  1. tasks 載入完成 (isAppReady)
 *  2. tasks.length === 0(全新使用者,沒有任何任務)
 *  3. localStorage 沒有 sentinel key `vibelist_onboarding_task_seen`
 *
 * 防重複保證：
 *  - sentinel 一旦寫入永遠不再注入(即使日後使用者刪光任務)
 *  - 雲端同步:addTask 內部會 batchSaveTasksFirebase → 多裝置首次登入也只有一次
 *  - useRef 守衛 effect 重複觸發(StrictMode 雙 mount / 重渲染)
 */
const SENTINEL_KEY = "vibelist_onboarding_task_seen";

const ONBOARDING_TASK_TITLE = "📱 將 VibeList 變成手機 App(點開看秘訣)";
const ONBOARDING_TASK_DESCRIPTION =
  "恭喜你來到這裡!為了獲得最沉浸的降噪體驗,強烈建議將 VibeList 加入主畫面:\n\n🍎 iOS: 點擊瀏覽器下方 [分享] 圖示 ➔ 選擇 [加入主畫面]\n🤖 Android: 點擊右上角 [⋮] ➔ 選擇 [加到主畫面]\n\n裝好之後,請勇敢地點擊這個任務的「完成」按鈕,體驗一下斬擊的快感吧!⚡️";

function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD(本地時區)
}

export function OnboardingTask() {
  const { tasks, addTask, isAppReady } = useApp();
  const injectedRef = useRef(false);

  useEffect(() => {
    // 守衛 1:元件已注入過(StrictMode 雙 mount 或重新 mount)
    if (injectedRef.current) return;
    // 守衛 2:資料還沒載入完成
    if (!isAppReady) return;
    // 守衛 3:sentinel 已存在 → 使用者曾經看過/刪除過,絕不再重生
    if (typeof window !== "undefined" && localStorage.getItem(SENTINEL_KEY) === "1") return;
    // 守衛 4:任務清單不是空(已有任務 → 不算首次使用者)
    if (tasks.length > 0) return;

    injectedRef.current = true;

    addTask({
      title: ONBOARDING_TASK_TITLE,
      description: ONBOARDING_TASK_DESCRIPTION,
      priority: "schedule",
      status: "todo",
      dueDate: getLocalToday(),
      tags: [],
      listId: DEFAULT_LIST_IDS["收集箱"],
      subTasks: [],
    });

    try {
      localStorage.setItem(SENTINEL_KEY, "1");
    } catch {
      // localStorage 寫入失敗(隱私模式/Quota)不阻塞,雲端已有任務就夠
    }
  }, [isAppReady, tasks.length, addTask]);

  return null;
}