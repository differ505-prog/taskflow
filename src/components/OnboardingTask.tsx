"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/lib/AppContext";
import { useAuth } from "@/lib/AuthContext";
import { DEFAULT_LIST_IDS } from "@/lib/types";

/**
 * 首次載入偵測：當使用者任務清單為空時,連續注入 3 筆 PWA 安裝教學任務。
 *
 * 為什麼分 3 筆而不是 1 筆寫在 description？
 *  Zen 模式焦點卡片沒有「展開詳情」互動,只能看標題 + 完成。
 *  所以教學必須直接寫在 title 中,並拆成 3 個獨立任務(iOS / Android / 收尾)
 *  讓使用者逐個勾選完成,獲得「斬擊快感」的反饋迴路。
 *
 * 觸發條件（全部 AND）：
 *  1. tasks 載入完成 (isAppReady)
 *  2. tasks.length === 0(全新使用者,沒有任何任務)
 *  3. localStorage 沒有 sentinel key(per-user)
 *  4. 使用者已登入(user.uid 已確定)
 *
 * 防重複保證：
 *  - sentinel 改用 `${uid}_${key}` 格式綁定使用者,跨裝置/瀏覽器/隱私視窗獨立追蹤
 *  - 教學任務透過 useApp.addTaskLocalOnly 注入,**不上雲端**（§修法 A）：
 *    避免「登出再登入時雲端殘留任務又 sync 回來」的 UX 噩夢
 *  - useRef 守衛 effect 重複觸發(StrictMode 雙 mount / 重渲染)
 *  - 3 筆必須全部 addTask 完成才寫 sentinel;任一筆中斷則下次重試仍能補齊
 */
const SENTINEL_KEY_PREFIX = "vibelist_onboarding_task_seen";

const ONBOARDING_TASK_TITLES = [
  "🍎 iOS 安裝:用 Safari 開啟本頁 ➔ 點下方 [分享] ➔ 選擇 [加入主畫面]",
  "🤖 Android 安裝:點右上角 [⋮] ➔ 選擇 [加到主畫面]",
  "⚡️ 裝好後,用 App 打開,把這三個任務全部斬斷吧!",
];

function getLocalToday(): string {
  return getLocalToday(); // YYYY-MM-DD(本地時區)
}

export function OnboardingTask() {
  const { tasks, addTaskLocalOnly, isAppReady } = useApp();
  const { user } = useAuth();
  const injectedRef = useRef(false);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return; // §修法 A:必須有 uid 才能寫入 per-user sentinel
    const sentinelKey = `${SENTINEL_KEY_PREFIX}_${uid}`;

    // 守衛 1:元件已注入過(StrictMode 雙 mount 或重新 mount)
    if (injectedRef.current) return;
    // 守衛 2:資料還沒載入完成
    if (!isAppReady) return;
    // 守衛 3:per-user sentinel 已存在 → 此使用者已看過/刪除過,絕不再重生
    if (typeof window !== "undefined" && localStorage.getItem(sentinelKey) === "1") return;
    // 守衛 4:任務清單不是空(已有任務 → 不算首次使用者)
    if (tasks.length > 0) return;

    injectedRef.current = true;

    const dueDate = getLocalToday();
    const listId = DEFAULT_LIST_IDS["收集箱"];

    // §修法 A:用 addTaskLocalOnly 注入,**純本地、不上雲端**。
    // 避免「登出再登入 → 雲端 sync 把這 3 筆教學任務又拉回來」的 UX 噩夢。
    addTaskLocalOnly(
      ONBOARDING_TASK_TITLES.map((title) => ({
        title,
        priority: "schedule" as const,
        status: "todo" as const,
        dueDate,
        tags: [],
        listId,
        subTasks: [],
      }))
    );

    try {
      localStorage.setItem(sentinelKey, "1");
    } catch {
      // localStorage 寫入失敗(隱私模式/Quota)不阻塞,雲端已有任務就夠
    }
  }, [isAppReady, tasks.length, addTaskLocalOnly, user?.uid]);

  return null;
}
