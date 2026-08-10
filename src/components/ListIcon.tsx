"use client";
import {
  ClipboardText, Briefcase, House, PersonSimpleRun, Books,
  Lightbulb, Target, Star, CurrencyDollar, FirstAid,
  Airplane, Palette, ForkKnife, Wrench, DeviceMobile, Laptop,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

/** 清單圖示渲染器：字串 → Phosphor 元件
 *  - 新清單：存 Phosphor 元件名（如 "ClipboardText"）
 *  - 舊清單：仍是 emoji 字串，直接顯示
 */
const ICON_MAP: Record<string, PhosphorIcon> = {
  ClipboardText, Briefcase, House, PersonSimpleRun, Books,
  Lightbulb, Target, Star, CurrencyDollar, FirstAid,
  Airplane, Palette, ForkKnife, Wrench, DeviceMobile, Laptop,
  // 舊 emoji 向後兼容
  "📋": ClipboardText, "💼": Briefcase, "🏠": House, "🏃": PersonSimpleRun,
  "📚": Books, "💡": Lightbulb, "🎯": Target, "🌟": Star,
  "💰": CurrencyDollar, "🏥": FirstAid, "✈️": Airplane, "🎨": Palette,
  "🍽️": ForkKnife, "🛠️": Wrench, "📱": DeviceMobile, "💻": Laptop,
};

export function ListIcon({ icon, className = "w-5 h-5" }: { icon: string; className?: string }) {
  const PhosphorIcon = ICON_MAP[icon];
  if (!PhosphorIcon) return <span className={className}>{icon}</span>; // 未知字串直接顯示（向後兼容）
  return <PhosphorIcon weight="regular" className={className} />;
}

export const LIST_ICON_NAMES = [
  "ClipboardText", "Briefcase", "House", "PersonSimpleRun", "Books",
  "Lightbulb", "Target", "Star", "CurrencyDollar", "FirstAid",
  "Airplane", "Palette", "ForkKnife", "Wrench", "DeviceMobile", "Laptop",
];
