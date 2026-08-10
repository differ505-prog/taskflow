/**
 * EmptyStateIllustrations — 情緒化插圖系統
 *
 * 每個 variant 的插圖是「複合 SVG」，包含氛圍元素（線條、形狀、符號），
 * 不是單一 icon。對齊 VOICE_AND_TONE.md §2 空狀態語態。
 *
 * 設計原則：
 * - viewBox="0 0 120 120"（固定比例，容器自適應）
 * - 配色走 CSS variable（--text-tertiary / --border / --brand）
 * - 裝飾線條用 stroke-dasharray 製造「未完成」韻味
 * - 每張插圖有「情緒核心」：不是裝飾，是語態的視覺翻譯
 */

import { ClipboardList, Inbox, Calendar, Layers, Flame, Tag, BarChart3 } from "lucide-react";

/* ─── inline SVG helper ─── */
function SvgWrap({
  children,
  className,
  "aria-hidden": ariaHidden,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-hidden"?: true;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden ?? true}
      role="img"
    >
      {children}
    </svg>
  );
}

/* ══════════════════════════════════════════════
   inbox — 「腦中先倒乾淨」：意識傾倒、收件籃
   ══════════════════════════════════════════════ */
export function InboxIllustration({ className }: { className?: string }) {
  return (
    <SvgWrap className={className}>
      {/* 背景：圓形虛化光 */}
      <circle cx="60" cy="58" r="48" fill="var(--bg-primary)" opacity="0.5" />
      {/* 主體：收件籃 */}
      <rect x="30" y="38" width="60" height="44" rx="8" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
      <path d="M36 38 L42 28 H78 L84 38" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* 傾倒線：意識流出 */}
      <path d="M54 12 Q50 20 46 28" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
      <path d="M60 8 Q58 18 58 28" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
      <path d="M66 12 Q70 20 74 28" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
      {/* 小圓點：念頭符號 */}
      <circle cx="48" cy="18" r="3" fill="var(--brand)" opacity="0.7" />
      <circle cx="60" cy="10" r="4" fill="var(--brand)" opacity="0.9" />
      <circle cx="72" cy="18" r="3" fill="var(--brand)" opacity="0.7" />
      {/* 底部：疊加小方塊＝任務 */}
      <rect x="42" y="50" width="12" height="8" rx="2" fill="var(--brand)" opacity="0.2" stroke="var(--brand)" strokeWidth="1" />
      <rect x="58" y="50" width="12" height="8" rx="2" fill="var(--brand)" opacity="0.15" stroke="var(--brand)" strokeWidth="1" />
      <rect x="42" y="62" width="12" height="8" rx="2" fill="var(--brand)" opacity="0.15" stroke="var(--brand)" strokeWidth="1" />
      <rect x="58" y="62" width="12" height="8" rx="2" fill="var(--brand)" opacity="0.2" stroke="var(--brand)" strokeWidth="1" />
    </SvgWrap>
  );
}

/* ══════════════════════════════════════════════
   today — 「今天還沒有任務」：日出、嶄新的一天
   ══════════════════════════════════════════════ */
export function TodayIllustration({ className }: { className?: string }) {
  return (
    <SvgWrap className={className}>
      {/* 背景：日出漸層 */}
      <circle cx="60" cy="72" r="36" fill="var(--bg-primary)" opacity="0.4" />
      {/* 地平線 */}
      <path d="M16 78 Q60 72 104 78" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.3" />
      {/* 太陽 */}
      <circle cx="60" cy="68" r="18" fill="var(--brand)" opacity="0.12" />
      <circle cx="60" cy="68" r="12" fill="var(--brand)" opacity="0.15" />
      <circle cx="60" cy="68" r="6" fill="var(--brand)" opacity="0.25" />
      {/* 陽光射線 */}
      <path d="M60 44 L60 36" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M78 52 L84 46" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M42 52 L36 46" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M86 68 L92 68" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M34 68 L28 68" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* 日曆小框 */}
      <rect x="44" y="82" width="32" height="24" rx="4" stroke="var(--text-tertiary)" strokeWidth="1.5" opacity="0.5" />
      <path d="M44 90 H76" stroke="var(--text-tertiary)" strokeWidth="1" opacity="0.4" />
      {/* 日期格子 */}
      {[0,1,2].map(i => (
        <rect key={i} x={46 + i * 8} y="94" width="5" height="5" rx="1" fill="var(--text-tertiary)" opacity="0.25" />
      ))}
    </SvgWrap>
  );
}

/* ══════════════════════════════════════════════
   all — 「你的任務從這裡開始」：起點、路標
   ══════════════════════════════════════════════ */
export function AllIllustration({ className }: { className?: string }) {
  return (
    <SvgWrap className={className}>
      {/* 背景：向遠方的透視 */}
      <path d="M60 20 L90 90 H30 Z" fill="var(--bg-primary)" opacity="0.3" />
      {/* 遠方小路 */}
      <path d="M52 80 Q60 60 60 20" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
      <path d="M68 80 Q60 60 60 20" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
      {/* 起點標記 */}
      <circle cx="60" cy="85" r="10" fill="var(--brand)" opacity="0.15" stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="60" cy="85" r="4" fill="var(--brand)" opacity="0.6" />
      {/* 前方終點 */}
      <circle cx="60" cy="20" r="5" fill="none" stroke="var(--brand)" strokeWidth="1.5" opacity="0.4" strokeDasharray="3 2" />
      {/* 兩側標誌 */}
      <path d="M28 70 L28 62 M22 66 H34" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M92 70 L92 62 M86 66 H98" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </SvgWrap>
  );
}

/* ══════════════════════════════════════════════
   habits — 「從一個小習慣開始」：種籽萌芽
   ══════════════════════════════════════════════ */
export function HabitsIllustration({ className }: { className?: string }) {
  return (
    <SvgWrap className={className}>
      {/* 花盆 */}
      <path d="M40 90 L46 72 H74 L80 90 Z" fill="var(--bg-primary)" stroke="var(--text-tertiary)" strokeWidth="1.5" opacity="0.5" />
      <path d="M36 72 H84" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* 莖 */}
      <path d="M60 72 Q58 58 60 48" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" />
      {/* 葉子 */}
      <path d="M60 62 Q48 56 52 44 Q64 52 60 62" fill="var(--brand)" opacity="0.2" stroke="var(--brand)" strokeWidth="1.2" />
      <path d="M60 58 Q72 52 68 40 Q56 48 60 58" fill="var(--brand)" opacity="0.15" stroke="var(--brand)" strokeWidth="1.2" />
      {/* 頂端小花 */}
      <circle cx="60" cy="44" r="6" fill="var(--brand)" opacity="0.25" />
      <circle cx="60" cy="44" r="3" fill="var(--brand)" opacity="0.5" />
      {/* 地面裝飾線 */}
      <path d="M20 96 Q60 92 100 96" stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="3 3" opacity="0.2" />
      {/* 小螞蟻：微小的堅持 */}
      <circle cx="78" cy="68" r="2" fill="var(--text-tertiary)" opacity="0.35" />
      <circle cx="82" cy="66" r="1.5" fill="var(--text-tertiary)" opacity="0.3" />
    </SvgWrap>
  );
}

/* ══════════════════════════════════════════════
   tags — 「整理一下任務的方式」：標籤叢林
   ══════════════════════════════════════════════ */
export function TagsIllustration({ className }: { className?: string }) {
  return (
    <SvgWrap className={className}>
      {/* 標籤群 */}
      {/* 標籤 1 */}
      <rect x="20" y="34" width="56" height="22" rx="6" fill="var(--bg-primary)" stroke="var(--text-tertiary)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="32" cy="45" r="4" fill="var(--brand)" opacity="0.5" />
      {/* 標籤 2 */}
      <rect x="28" y="60" width="56" height="22" rx="6" fill="var(--bg-primary)" stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.4" />
      <circle cx="40" cy="71" r="4" fill="var(--brand)" opacity="0.35" />
      {/* 標籤 3 */}
      <rect x="44" y="86" width="48" height="18" rx="6" fill="var(--bg-primary)" stroke="var(--text-tertiary)" strokeWidth="1.5" opacity="0.3" />
      <circle cx="54" cy="95" r="3" fill="var(--text-tertiary)" opacity="0.4" />
      {/* 連接線：整理的意象 */}
      <path d="M56 45 Q72 55 72 71" stroke="var(--brand)" strokeWidth="1" strokeDasharray="3 2" opacity="0.3" />
      <path d="M72 71 Q72 85 66 95" stroke="var(--brand)" strokeWidth="1" strokeDasharray="3 2" opacity="0.2" />
      {/* 整理完成的小勾 */}
      <path d="M88 28 L92 32 L98 24" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </SvgWrap>
  );
}

/* ══════════════════════════════════════════════
   stats — 「等你完成一些任務」：等待生長的柱狀圖
   ══════════════════════════════════════════════ */
export function StatsIllustration({ className }: { className?: string }) {
  return (
    <SvgWrap className={className}>
      {/* 基線 */}
      <path d="M20 90 H100" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.3" />
      {/* 軸線 */}
      <path d="M20 20 V90" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
      {/* 柱狀：低高度 = 等待中 */}
      {[30, 46, 60, 74, 88].map((x, i) => (
        <rect
          key={i}
          x={x}
          y={90 - 16 - i * 4}
          width="10"
          height={16 + i * 4}
          rx="3"
          fill="var(--brand)"
          opacity={0.12 + i * 0.04}
          stroke="var(--brand)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
      ))}
      {/* 向上箭頭：等待生長 */}
      <path d="M86 30 L92 24 M92 24 L98 30 M92 24 V36" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      {/* 小星星裝飾 */}
      <path d="M18 18 L19.5 21 L23 21.5 L20.5 24 L21 28 L18 26 L15 28 L15.5 24 L13 21.5 L16.5 21 Z" fill="var(--brand)" opacity="0.25" />
    </SvgWrap>
  );
}

/* ══════════════════════════════════════════════
   general — 「建立第一個任務」：筆與空白頁
   ══════════════════════════════════════════════ */
export function GeneralIllustration({ className }: { className?: string }) {
  return (
    <SvgWrap className={className}>
      {/* 紙張 */}
      <rect x="26" y="18" width="68" height="84" rx="6" fill="var(--bg-primary)" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.4" />
      {/* 折角 */}
      <path d="M76 18 L94 18 L94 36 L76 36 Z" fill="var(--bg-primary)" stroke="var(--text-tertiary)" strokeWidth="1" opacity="0.3" />
      <path d="M76 18 L76 36 L94 36" stroke="var(--text-tertiary)" strokeWidth="1" fill="none" opacity="0.3" />
      {/* 空白線條 */}
      {[38, 50, 62, 74, 86].map((y, i) => (
        <path key={i} d={`M38 ${y} H82`} stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="4 3" opacity={0.15 + i * 0.05} />
      ))}
      {/* 筆 */}
      <path d="M72 8 L88 24" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
      <path d="M88 24 L92 28 L84 36 L80 32 Z" fill="var(--brand)" opacity="0.4" stroke="var(--brand)" strokeWidth="1" />
      {/* 筆尖 */}
      <path d="M80 32 L72 8" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
      {/* 指示線：筆應在的位置 */}
      <path d="M62 48 Q72 38 82 42" stroke="var(--brand)" strokeWidth="1" strokeDasharray="3 2" opacity="0.3" />
      <circle cx="84" cy="42" r="2" fill="var(--brand)" opacity="0.4" />
    </SvgWrap>
  );
}

/* ══════════════════════════════════════════════
   zen — 「戰場很安靜」：留白、月光
   ══════════════════════════════════════════════ */
export function ZenIllustration({ className }: { className?: string }) {
  return (
    <SvgWrap className={className}>
      {/* 大量留白背景圓 */}
      <circle cx="60" cy="60" r="52" fill="var(--bg-primary)" opacity="0.3" />
      {/* 月亮 */}
      <circle cx="60" cy="52" r="22" fill="var(--brand)" opacity="0.1" />
      <circle cx="68" cy="46" r="18" fill="var(--bg-primary)" /> {/* 遮擋製造月牙 */}
      {/* 月暈 */}
      <circle cx="60" cy="52" r="30" fill="none" stroke="var(--brand)" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
      {/* 星光點 */}
      {[24, 96, 38, 82].map((x, i) => (
        <circle key={i} cx={x} cy={[16, 16, 98, 98][i]} r="1.5" fill="var(--brand)" opacity={0.2 + i * 0.05} />
      ))}
      <path d="M20 20 L22 24 L26 24 L23 27 L24 31 L20 28 L16 31 L17 27 L14 24 L18 24 Z" fill="var(--brand)" opacity="0.2" />
      {/* 水面倒影線 */}
      <path d="M16 88 Q60 82 104 88" stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="3 3" opacity="0.2" />
      <path d="M28 94 Q60 90 92 94" stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="3 3" opacity="0.12" />
    </SvgWrap>
  );
}

/* ─── 向後相容：Lucide icon fallback ─── */
export {
  ClipboardList as GeneralIcon,
  Inbox as InboxIcon,
  Calendar as TodayIcon,
  Layers as AllIcon,
  Flame as HabitsIcon,
  Tag as TagsIcon,
  BarChart3 as StatsIcon,
};
