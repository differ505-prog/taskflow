"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, ExternalLink } from "lucide-react";
import { formatFileSize } from "@/lib/storageUpload";

export interface LightboxImageItem {
  id: string;
  name: string;
  url: string;
  size?: number;
}

interface ImageLightboxModalProps {
  images: LightboxImageItem[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

/**
 * App 內原位全螢幕看圖燈箱（9.5/10 方案）：
 * - 點擊圖片縮圖或列即原地放大顯示，不跳出 PWA / 不強制開新分頁
 * - 支援多圖左右切換（按鈕 + 鍵盤方向鍵 + 手機滑動）、雙擊/按鈕縮放（1x / 2x）
 * - 底部保留下載與新分頁開啟原圖入口
 */
export function ImageLightboxModal({
  images,
  initialIndex,
  open,
  onClose,
}: ImageLightboxModalProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const safeIdx = Math.max(0, Math.min(initialIndex, Math.max(0, images.length - 1)));
      setIndex(safeIdx);
      setZoomed(false);
    }
  }, [open, initialIndex, images.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft" && images.length > 1) {
        e.preventDefault();
        setZoomed(false);
        setIndex((i) => (i - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight" && images.length > 1) {
        e.preventDefault();
        setZoomed(false);
        setIndex((i) => (i + 1) % images.length);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, images.length, onClose]);

  if (!open || !mounted || images.length === 0) return null;

  const current = images[Math.min(index, images.length - 1)];
  const hasMultiple = images.length > 1;

  const goPrev = () => {
    setZoomed(false);
    setIndex((i) => (i - 1 + images.length) % images.length);
  };
  const goNext = () => {
    setZoomed(false);
    setIndex((i) => (i + 1) % images.length);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`圖片預覽：${current.name}`}
      className="fixed inset-0 z-[120] flex flex-col bg-black/90 backdrop-blur-sm select-none"
      onClick={onClose}
      onTouchStart={(e) => {
        if (!zoomed && e.touches.length === 1) {
          touchStartXRef.current = e.touches[0].clientX;
        }
      }}
      onTouchEnd={(e) => {
        if (zoomed || touchStartXRef.current === null || !hasMultiple) {
          touchStartXRef.current = null;
          return;
        }
        const dx = e.changedTouches[0].clientX - touchStartXRef.current;
        touchStartXRef.current = null;
        if (dx > 50) goPrev();
        else if (dx < -50) goNext();
      }}
    >
      {/* Top Bar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-white/90 flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-medium truncate">{current.name}</p>
          <p className="text-[11px] text-white/60 tabular-nums">
            {hasMultiple ? `${index + 1} / ${images.length}` : ""}
            {hasMultiple && current.size ? " · " : ""}
            {typeof current.size === "number" ? formatFileSize(current.size) : ""}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={zoomed ? "縮小為符合螢幕" : "放大檢視細節"}
            aria-label={zoomed ? "縮小" : "放大"}
          >
            {zoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
          </button>
          <a
            href={current.url}
            download={current.name}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="下載原圖"
            aria-label="下載原圖"
          >
            <Download className="w-4 h-4" />
          </a>
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="在新分頁開啟"
            aria-label="在新分頁開啟"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
            title="關閉預覽 (Esc)"
            aria-label="關閉預覽"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-auto p-4">
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="hidden sm:flex absolute left-4 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
            aria-label="上一張"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <img
          src={current.url}
          alt={current.name}
          onClick={(e) => {
            e.stopPropagation();
            setZoomed((z) => !z);
          }}
          className={`rounded-lg shadow-2xl transition-transform duration-200 ${
            zoomed
              ? "max-w-none max-h-none scale-100 cursor-zoom-out"
              : "max-w-full max-h-full object-contain cursor-zoom-in"
          }`}
          style={zoomed ? { width: "min(180vw, 1600px)", height: "auto" } : undefined}
        />

        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="hidden sm:flex absolute right-4 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
            aria-label="下一張"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
