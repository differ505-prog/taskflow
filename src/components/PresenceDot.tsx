"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getEstimatedActiveUsers } from "@/lib/presenceMock";

/**
 * PresenceDot — 陪伴指示燈 (Body Doubling Indicator)
 *
 * 品牌承諾:真實與脆弱
 * - 主畫面顯示「估計」範圍(不假裝是即時精確數據)
 * - hover tooltip 揭露「這是估算」(主動建立信任)
 * - 不抖動、不點擊、不推廣(純環境背景元素)
 *
 * 視覺規範:
 * - 位置:fixed bottom-6 right-6 (右下角,與左下 WarmupSection 對稱)
 * - 桌機 / 手機都顯示(無需 md:hidden,因為右側沒有其他 fixed 元素競爭)
 * - 綠色呼吸圓點 + text-zinc-400 細字
 * - safe-area-inset 處理 iOS 底部
 *
 * §15.4 mobile safe area: iOS 底部按鈕可能跟 home indicator 衝突
 */
export default function PresenceDot() {
  // useMemo:只在 mount 計算一次,跨小時邊界不重算(spec:不需要頻繁變動)
  const range = useMemo(() => getEstimatedActiveUsers(new Date()), []);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full bg-slate-100/50 px-3 py-1.5 backdrop-blur"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`此刻約有 ${range.min} 到 ${range.max} 位專注中,這是基於時區的估算數值`}
    >
      {/* 綠點 → 柔和 emerald-400/70 + 微弱 pulse(已有 animate-ping) */}
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40 opacity-50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
      </span>

      {/* 主文案:字體縮小 + 顏色調淡,更緊密依附 FAB */}
      <span className="text-[11px] text-slate-400 tabular-nums">
        此刻約有 {range.min}-{range.max} 位專注中
      </span>

      {/* Hover tooltip — 揭露這是估算,建立信任 */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute bottom-full right-0 mb-2 w-64 rounded-lg bg-slate-800/95 px-3 py-2 text-xs leading-relaxed text-slate-100 shadow-lg backdrop-blur"
            role="tooltip"
          >
            此刻約有 {range.min} 到 {range.max} 位用戶與你同在,這是基於時區的估算,希望能為你的專注時刻帶來一點安靜的陪伴。
            {/* 小三角箭頭 */}
            <span
              className="absolute right-4 top-full h-2 w-2 -translate-y-1/2 rotate-45 bg-slate-800/95"
              aria-hidden
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}