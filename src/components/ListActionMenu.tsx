"use client";

import { Edit3, Share2, Trash2 } from "lucide-react";
import { TaskList, Task } from "@/lib/types";
import { useConfirm } from "@/hooks/useConfirm";

interface ListActionMenuProps {
  open: boolean;
  onClose: () => void;
  // 兩種模式二選一：自有清單 / 共用清單
  list?: TaskList | null;
  sharedList?: { list: TaskList; tasks: Task[] } | null;
  // 自有清單的「分享」需傳入此清單下任務陣列（SharedList 模式從 sharedList.tasks 自行帶入）
  tasksForShare?: Task[];
  onEdit?: (list: TaskList) => void;
  onShare?: (list: TaskList, tasks: Task[]) => void;
  onDelete?: (list: TaskList) => void | Promise<void>;
  onLeaveShared?: (sharedId: string) => void;
  // 刪除確認時需要的「此清單下未封存任務數」
  taskCount?: number;
  // 樣式變體：floating(預設,桌機/絕對定位用) / inline(嵌於父層內,手機展開用)
  variant?: "floating" | "inline";
}

/**
 * 共用清單操作 menu — 桌機 Sidebar 與手機 BottomNavigation 共用。
 * 透過 `open` + `onClose` + 任一 list/sharedList 設定目標,handlers 由父層注入。
 * 設計:
 *  - 自有清單 → 顯示「編輯 / 分享 / 刪除」
 *  - 共用清單 → 顯示「退出共用」
 *  - 刪除前用 useConfirm 詢問(taskCount 影響 impactDetail)
 *  - 點擊任一動作後自動 onClose (慣例)
 */
export function ListActionMenu({
  open,
  onClose,
  list,
  sharedList,
  tasksForShare,
  onEdit,
  onShare,
  onDelete,
  onLeaveShared,
  taskCount = 0,
  variant = "floating",
}: ListActionMenuProps) {
  const confirm = useConfirm();

  if (!open) return null;

  const targetList = list ?? sharedList?.list ?? null;
  if (!targetList) return null;

  const containerStyle =
    variant === "inline"
      ? { background: "var(--surface)" }
      : { background: "var(--surface-elevated)", boxShadow: "var(--shadow-md)" };

  const handleEdit = () => {
    onEdit?.(targetList);
    onClose();
  };

  const handleShare = () => {
    if (sharedList) {
      onShare?.(sharedList.list, sharedList.tasks);
    } else if (list) {
      onShare?.(list, tasksForShare ?? []);
    }
    onClose();
  };

  const handleDelete = async () => {
    const ok = await confirm({
      intent: "delete",
      title: `刪除清單「${targetList.name}」`,
      message: "此操作會將清單下的任務改為「未分類」,清單本身將永久移除。",
      impactDetail: taskCount > 0 ? `${taskCount} 項任務將改為未分類` : "此清單下沒有任務",
      tone: "danger",
    });
    if (ok) {
      await onDelete?.(targetList);
      onClose();
    }
  };

  const handleLeave = () => {
    const sharedId = sharedList?.list.sharedId ?? targetList.sharedId;
    if (sharedId) {
      onLeaveShared?.(sharedId);
      onClose();
    }
  };

  // 共用清單模式
  if (sharedList) {
    return (
      <div
        className="py-1 w-44 rounded-xl border"
        style={{ ...containerStyle, borderColor: "var(--border)" }}
        role="menu"
        aria-label="共用清單操作"
      >
        <button
          onClick={handleLeave}
          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          style={{ color: "var(--status-danger)" }}
          role="menuitem"
        >
          <Trash2 className="w-3.5 h-3.5" /> 退出共用清單
        </button>
      </div>
    );
  }

  // 自有清單模式
  return (
    <div
      className="py-1 w-44 rounded-xl border"
      style={{ ...containerStyle, borderColor: "var(--border)" }}
      role="menu"
      aria-label="清單操作"
    >
      {onEdit && (
        <button
          onClick={handleEdit}
          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          style={{ color: "var(--text-primary)" }}
          role="menuitem"
        >
          <Edit3 className="w-3.5 h-3.5" /> 編輯清單
        </button>
      )}
      {onShare && (
        <button
          onClick={handleShare}
          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          style={{ color: "var(--brand)" }}
          role="menuitem"
        >
          <Share2 className="w-3.5 h-3.5" /> 分享清單
        </button>
      )}
      {onDelete && (
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          style={{ color: "var(--status-danger)" }}
          role="menuitem"
        >
          <Trash2 className="w-3.5 h-3.5" /> 刪除清單
        </button>
      )}
    </div>
  );
}
