"use client";

import { useSortable } from "@dnd-kit/sortable";
import { TaskListItem } from "./TaskListItem";
import type { Task, Priority } from "@/lib/types";

interface SortableTaskItemProps {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
  onToggleStatus: (id: string) => void;
  onToggleSubTask?: (taskId: string, subId: string) => void;
  onUpdatePriority?: (id: string, p: Priority) => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
  onTogglePin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddToToday?: (taskId: string) => void; // T2-b 桌面+手機統一「加入今日」
  allTags?: string[];
  batchMode?: boolean;
  batchSelected?: boolean;
  onLongPress?: () => void;
  onBatchToggle?: () => void;
  // §新增「T 鍵加入今日」:透傳 hover/focus 到 TaskListItem
  onHoverEnter?: (id: string) => void;
  onHoverLeave?: (id: string) => void;
}

/**
 * O-007：把 useSortable 包成 wrapper,讓子元件 TaskListItem 保持純展示,
 * sortable hook 透過 props 注入。
 * （useSortable 必須在 SortableContext 子樹內呼叫,所以包成 component 而不是直接呼叫）
 */
export function SortableTaskItem(props: SortableTaskItemProps) {
  const sortable = useSortable({ id: props.task.id });
  return (
    <div
      style={{ touchAction: "pan-y" }}
      // Bug C #014 第 3 輪修法：明確設定 touchAction: pan-y,
      // 確保 sortable item 允許瀏覽器原生垂直 pan(scroll container 收到 touch 事件),
      // 配合 TouchSensor(delay: 250) 處理拖曳意圖,scroll 跟 drag 互不干擾。
      data-sortable-task-item
    >
      <TaskListItem {...props} sortable={sortable} />
    </div>
  );
}
