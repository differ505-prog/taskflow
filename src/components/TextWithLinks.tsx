"use client";

import { useMemo, useCallback } from "react";

/**
 * 自動把純文字中的 URL (http/https/www.) 變成可點擊的超連結。
 * - 不解析整個 Markdown(避免 XSS 與複雜渲染)
 * - 保留換行
 * - target="_blank" rel="noopener noreferrer"
 */

const URL_REGEX = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;

interface TextWithLinksProps {
  text: string;
  className?: string;
  linkClassName?: string;
  style?: React.CSSProperties;
  linkStyle?: React.CSSProperties;
}

export function TextWithLinks({
  text,
  className,
  linkClassName,
  style,
  linkStyle,
}: TextWithLinksProps) {
  const segments = useMemo(() => {
    if (!text) return [];
    const parts: Array<{ type: "text" | "link"; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // 重置 regex lastIndex
    URL_REGEX.lastIndex = 0;
    while ((match = URL_REGEX.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: "link", value: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: "text", value: text.slice(lastIndex) });
    }
    return parts;
  }, [text]);

  const normalizeHref = useCallback((raw: string) =>
    raw.startsWith("www.") ? `https://${raw}` : raw,
  []);

  return (
    <span className={className} style={{ ...style, whiteSpace: "pre-wrap" }}>
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={i}
            href={normalizeHref(seg.value)}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
            style={linkStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {seg.value}
          </a>
        ) : (
          <span key={i}>{seg.value}</span>
        ),
      )}
    </span>
  );
}
