"use client";
import {
  ClipboardList, Briefcase, Home, PersonStanding, BookOpen,
  Lightbulb, Target, Star, DollarSign, HeartPulse,
  Plane, Palette, UtensilsCrossed, Wrench, Smartphone, Laptop,
  type LucideIcon,
} from "lucide-react";

/** 清單圖示渲染器：字串 → Lucide 元件
 *  - 新清單：存 Lucide 元件名（如 "ClipboardList"）
 *  - 舊清單：仍是 emoji 字串，直接顯示
 */
const ICON_MAP: Record<string, LucideIcon> = {
  ClipboardList, Briefcase, Home, PersonStanding, BookOpen,
  Lightbulb, Target, Star, DollarSign, HeartPulse,
  Plane, Palette, UtensilsCrossed, Wrench, Smartphone, Laptop,
  // 舊 emoji 向後兼容
  "📋": ClipboardList, "💼": Briefcase, "🏠": Home, "🏃": PersonStanding,
  "📚": BookOpen, "💡": Lightbulb, "🎯": Target, "🌟": Star,
  "💰": DollarSign, "🏥": HeartPulse, "✈️": Plane, "🎨": Palette,
  "🍽️": UtensilsCrossed, "🛠️": Wrench, "📱": Smartphone, "💻": Laptop,
};

export function ListIcon({ icon, className = "w-5 h-5" }: { icon: string; className?: string }) {
  const LucideIcon = ICON_MAP[icon];
  if (!LucideIcon) return <span className={className}>{icon}</span>; // 未知字串直接顯示（向後兼容）
  return <LucideIcon className={className} />;
}

export const LIST_ICON_NAMES = [
  "ClipboardList", "Briefcase", "Home", "PersonStanding", "BookOpen",
  "Lightbulb", "Target", "Star", "DollarSign", "HeartPulse",
  "Plane", "Palette", "UtensilsCrossed", "Wrench", "Smartphone", "Laptop",
];
