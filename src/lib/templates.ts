/**
 * 範本市集套用邏輯
 *
 * 設計原則：
 * - 純函式 + 不耦合 UI，便於測試與日後改用 server-side 觸發
 * - 套用流程：addList(建立專屬清單) → 迴圈 addTask(每個任務帶 listId)
 * - 利用既有的 addList / addTask 介面，自動享有 optimistic update +
 *   personalTaskSync → supabase realtime 同步；不需要再繞一道 batchSave
 * - 子任務透過 addTask 的 subTasks 欄位帶入（既有 schema 已支援）
 *
 * 副作用：
 * - 每個 addTask 都會呼叫 markRecentlyWritten → §26 類別 A 的 5 秒
 *   「最近寫入保護窗」自動覆蓋,避免首寫入被 supabase 第一次訂閱
 *   的舊快照回寫蓋掉
 */

import type { Task, Priority, SubTask } from "./types";
import templatesData from "@/data/templates.json";

export interface TemplateTaskDraft {
  title: string;
  description?: string;
  priority: Priority;
  /** 從套用日起算 offsetDays 後當作 dueDate */
  offsetDays?: number;
  subTasks?: { title: string }[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tags: string[];
  tasks: TemplateTaskDraft[];
}

const rawTemplates = templatesData as { version: number; templates: Template[] };

/** 對外暴露的範本清單（不可變,避免誤改） */
export const TEMPLATES: readonly Template[] = Object.freeze(rawTemplates.templates);

export interface ApplyResult {
  listId: string;
  taskIds: string[];
}

/**
 * 把 ISO 日期字串往後推 offsetDays 天（YYYY-MM-DD 格式）
 */
function addDaysISO(base: Date, offsetDays: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface ApplyContext {
  addList: (data: {
    name: string;
    icon: string;
    color: string;
  }) => string;
  addTask: (
    data: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">
  ) => string;
  /** 注入用於測試；正式執行時預設為 new Date() */
  now?: Date;
}

/**
 * 套用單一範本：建立清單 + 寫入所有任務 + 子任務。
 *
 * 失敗時不會回滾已建立的任務（保留樂觀更新體驗），
 * 由 supabase sync 與 markRecentlyWritten 共同保護一致性。
 *
 * 為何 addList 要回傳 id：listId 必須在 addTask 呼叫時就確定,
 * 不能等 React state commit 後再讀,否則會有 1 frame 的 listId=undefined 渲染。
 */
export function applyTemplate(template: Template, ctx: ApplyContext): ApplyResult {
  const now = ctx.now ?? new Date();

  const listId = ctx.addList({
    name: template.name,
    icon: template.icon,
    color: template.color,
  });

  const taskIds: string[] = [];
  for (const t of template.tasks) {
    const subTasks: SubTask[] | undefined = t.subTasks?.map((s) => ({
      id: crypto.randomUUID(),
      title: s.title,
      status: "todo" as const,
      createdAt: now.toISOString(),
    }));

    const id = ctx.addTask({
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: "todo",
      dueDate: typeof t.offsetDays === "number" ? addDaysISO(now, t.offsetDays) : undefined,
      tags: template.tags.slice(0, 1),
      listId,
      subTasks,
    });
    taskIds.push(id);
  }

  return { listId, taskIds };
}

/**
 * 取得單一範本 by id
 */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
