import type { SubTask } from "@/lib/types";

export function sortSubTasks(subTasks: SubTask[]): SubTask[] {
  return [...subTasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return 0;
  });
}
