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
  allTags?: string[];
  batchMode?: boolean;
  batchSelected?: boolean;
  onLongPress?: () => void;
  onBatchToggle?: () => void;
}

/**
 * O-007：把 useSortable 包成 wrapper,讓子元件 TaskListItem 保持純展示,
 * sortable hook 透過 props 注入。
 * （useSortable 必須在 SortableContext 子樹內呼叫,所以包成 component 而不是直接呼叫）
 */
export function SortableTaskItem(props: SortableTaskItemProps) {
  const sortable = useSortable({ id: props.task.id });
  return <TaskListItem {...props} sortable={sortable} />;
}
