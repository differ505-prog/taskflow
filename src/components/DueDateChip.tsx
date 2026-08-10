"use client";

import { Clock, Bell } from "lucide-react";
import { parseISO, isToday, isTomorrow, isPast } from "date-fns";
import { zhTW } from "date-fns/locale";
import { format } from "date-fns";
import { getDeadlineStatus } from "@/lib/deadlineEngine";

interface DueDateChipProps {
  dueDate?: string;
  startDate?: string;
  dueTime?: string;
  isDone: boolean;
}

interface DueDateInfo {
  text: string;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
}

function getDueDateInfo(dateStr: string | undefined, startDateStr?: string): DueDateInfo | null {
  if (!dateStr) return null;
  try {
    const date = parseISO(dateStr);
    const overdue = !isToday(date) && isPast(date);

    if (startDateStr && startDateStr !== dateStr) {
      const start = parseISO(startDateStr);
      const startLabel = isToday(start) ? "今天" : format(start, "M/d", { locale: zhTW });
      const endLabel = isToday(date) ? "今天" : isTomorrow(date) ? "明天" : format(date, "M/d", { locale: zhTW });
      return {
        text: `${startLabel}～${endLabel}`,
        isOverdue: overdue,
        isToday: isToday(date) || isToday(start),
        isTomorrow: isTomorrow(date) || isTomorrow(start),
      };
    }

    return {
      text: isToday(date) ? "今天" : isTomorrow(date) ? "明天" : format(date, "M/d", { locale: zhTW }),
      isOverdue: overdue,
      isToday: isToday(date),
      isTomorrow: isTomorrow(date),
    };
  } catch {
    return null;
  }
}

export function DueDateChip({ dueDate, startDate, dueTime, isDone }: DueDateChipProps) {
  const dueInfo = getDueDateInfo(dueDate, startDate);
  const deadlineStatus = getDeadlineStatus(dueDate, dueTime, isDone);

  if (!dueInfo) return null;

  // B1: 計算「距 dueDate+dueTime 還剩多久」決定是否顯示 bell icon
  const now = new Date();
  let showBell = false;
  let isUrgentSoon = false;
  if (!isDone && dueDate) {
    const dueDateTime = dueTime
      ? new Date(`${dueDate}T${dueTime}:00`)
      : new Date(`${dueDate}T23:59:59`);
    if (!isNaN(dueDateTime.getTime())) {
      const diffMs = dueDateTime.getTime() - now.getTime();
      showBell = diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
      isUrgentSoon = diffMs > 0 && diffMs <= 60 * 60 * 1000;
    }
  }

  if (deadlineStatus) {
    return (
      <span
        className="pill-muted text-[11px] py-0.5"
        style={{
          background: `${deadlineStatus.colorVar}15`,
          color: deadlineStatus.colorVar,
          border: `1px solid ${deadlineStatus.colorVar}30`,
        }}
        title={deadlineStatus.tooltip}
        aria-label={`截止警示: ${deadlineStatus.text}`}
      >
        <Clock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {deadlineStatus.text}
        {showBell && (
          <Bell
            className="w-3 h-3 flex-shrink-0 ml-0.5"
            style={isUrgentSoon ? { animation: "bellRing 1.5s ease-in-out infinite" } : undefined}
            aria-label="即將到來"
          />
        )}
      </span>
    );
  }

  return (
    <span
      className="pill-muted text-[11px] py-0.5"
      style={
        dueInfo.isOverdue && !isDone
          ? { background: "var(--surface-muted)", color: "var(--priority-do-now)" }
          : dueInfo.isToday
          ? { background: "var(--brand-tint)", color: "var(--brand)" }
          : isUrgentSoon
          ? { background: "color-mix(in srgb, var(--status-warning) 10%, transparent)", color: "var(--status-warning)" }
          : {}
      }
    >
      <Clock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      {/* §L1-L4 防護:不再顯示「逾期」責備字眼,過期也用「風鈴提示」中性詞 */}
      {dueInfo.isOverdue && !isDone ? "風鈴提示" : dueInfo.text}
      {showBell && (
        <Bell
          className="w-3 h-3 flex-shrink-0 ml-0.5"
          style={isUrgentSoon ? { animation: "bellRing 1.5s ease-in-out infinite" } : undefined}
          aria-label="即將到來"
        />
      )}
    </span>
  );
}
