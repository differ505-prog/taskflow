"use client";

import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Calendar, Clock, X } from "lucide-react";
import {
  getInclusiveDayCount,
  getQuickDatePresets,
  isMultiDayRange,
  shiftRangeByStartDate,
} from "@/lib/dateRangeHelpers";

interface TaskDateRangeFieldProps {
  startDate: string;
  dueDate: string;
  onChangeDates: (startDate: string, dueDate: string) => void;
  /** 可選：一鍵清除日期回调（TaskDetailPanel 使用） */
  onClear?: () => void;
  /** 切換任務時重置單日／跨日模式 */
  resetKey?: string;
}

function formatShortLabel(iso: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

/**
 * 方案 2A：預設單日 1 格 ＋ 按需展開跨日 ＋ 跨日自動平移
 * - 單日任務只需調整 1 個日期欄，並提供「今天 / 明天 / 下週一」快捷鈕
 * - 點「＋設為跨日」才展開起訖兩格；調整開始日會保留原區間天數自動平移截止日
 */
export function TaskDateRangeField({
  startDate,
  dueDate,
  onChangeDates,
  onClear,
  resetKey,
}: TaskDateRangeFieldProps) {
  const [multiDayOpen, setMultiDayOpen] = useState(() =>
    isMultiDayRange(startDate, dueDate)
  );

  useEffect(() => {
    setMultiDayOpen(isMultiDayRange(startDate, dueDate));
    // 僅在切換任務（resetKey 改變）或外部把任務變成跨日時重算顯示模式
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isMultiDayRange(startDate, dueDate)) {
      setMultiDayOpen(true);
    }
  }, [startDate, dueDate]);

  const singleDateValue = dueDate || startDate || "";
  const quickPresets = getQuickDatePresets();

  const handleEnableMultiDay = () => {
    const baseStart = singleDateValue || quickPresets[0].date;
    const nextDue =
      dueDate && dueDate > baseStart
        ? dueDate
        : format(addDays(parseISO(baseStart), 1), "yyyy-MM-dd");
    setMultiDayOpen(true);
    onChangeDates(baseStart, nextDue);
  };

  const handleBackToSingleDay = () => {
    setMultiDayOpen(false);
    onChangeDates("", dueDate || startDate);
  };

  return (
    <div className="space-y-2.5">
      {!multiDayOpen ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
              <label
                className="text-[13px] font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                日期
              </label>
            </div>
            <button
              type="button"
              onClick={handleEnableMultiDay}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors hover:bg-[var(--hover-bg)]"
              style={{ color: "var(--brand)" }}
              title="展開開始與截止日期以設定多天區間"
            >
              ＋設為跨日
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={singleDateValue}
              onChange={(e) => onChangeDates("", e.target.value)}
              className="input cursor-pointer flex-1"
              aria-label="任務日期"
            />
            {singleDateValue && onClear && (
              <button
                type="button"
                onClick={onClear}
                aria-label="清除任務日期"
                title="清除日期"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-[var(--hover-danger)] hover:text-rose-500"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {quickPresets.map((preset) => {
              const active = singleDateValue === preset.date;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChangeDates("", preset.date)}
                  aria-pressed={active}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                  style={
                    active
                      ? { background: "var(--brand)", color: "var(--brand-foreground)" }
                      : { background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
                <label
                  className="text-[13px] font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  開始日期
                </label>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const shifted = shiftRangeByStartDate(
                    startDate,
                    dueDate,
                    e.target.value
                  );
                  onChangeDates(shifted.startDate, shifted.dueDate);
                }}
                className="input cursor-pointer"
                aria-label="開始日期"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
                <label
                  className="text-[13px] font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  截止日期
                </label>
              </div>
              <input
                type="date"
                value={dueDate}
                min={startDate || undefined}
                onChange={(e) => onChangeDates(startDate, e.target.value)}
                className="input cursor-pointer"
                aria-label="截止日期"
              />
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-2 text-[12px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              <span>
                {startDate && dueDate && startDate !== dueDate
                  ? `${formatShortLabel(startDate)} ~ ${formatShortLabel(dueDate)}（共 ${getInclusiveDayCount(startDate, dueDate)} 天）`
                  : formatShortLabel(startDate || dueDate)}
              </span>
              {onClear && (startDate || dueDate) && (
                <button
                  type="button"
                  onClick={onClear}
                  aria-label="清除任務日期"
                  title="清除日期"
                  className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-[var(--hover-danger)] hover:text-rose-500"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleBackToSingleDay}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors hover:bg-[var(--hover-bg)]"
              style={{ color: "var(--text-secondary)" }}
            >
              改回單日
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
