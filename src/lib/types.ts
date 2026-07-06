export type Priority = "high" | "medium" | "low";
export type TaskStatus = "todo" | "in-progress" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface TaskFilter {
  status?: TaskStatus;
  priority?: Priority;
  tag?: string;
  search?: string;
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  high: {
    label: "高",
    color: "text-red-600",
    bg: "bg-red-50",
  },
  medium: {
    label: "中",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  low: {
    label: "低",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  "todo": {
    label: "待辦",
    color: "text-slate-600",
    bg: "bg-slate-100",
  },
  "in-progress": {
    label: "進行中",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  "done": {
    label: "已完成",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};
