import type { SubTask } from "@/lib/types";

/**
 * 子任務排序:O-008 dnd-kit 拖曳需要穩定 order。
 * - 不同 status 分組(todo 在前、done 在後)
 * - 同 status 內按 order 由小到大
 * - order 缺值(undefined)時用 createdAt 兜底(舊資料 lazy migrate)
 */
export function sortSubTasks(subTasks: SubTask[]): SubTask[] {
  return [...subTasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    // 同 status 內:order 升冪;undefined 視為 +Infinity 墊底(因舊資料未排序)
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    // order 相等 → 用 createdAt 兜底,確保 sort 是 stable
    return a.createdAt.localeCompare(b.createdAt);
  });
}
