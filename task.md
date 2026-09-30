# VibeList 視覺設計美化實作清單

> 日期：2026-09-30
> 依據：Principal UI Palette & Layout Director 評審報告
> 評審時點：2026-09-30 15:13 UTC+8
> 審查目標：`/login` (LandingPage) + `/waitlist` 公開頁
> 操作防線：**所有修改完成後，`tsc --noEmit` + `npm run build` 均成功才算完成**

---

## 前置檢查清單（每次實作前確認）

- [ ] `git status` 確認無未 commit 變更
- [ ] `npm run build` 確認乾淨 build 基線（0 errors）
- [ ] `npx tsc --noEmit` 確認 0 type errors

---

## 實作分組（修復優先順序）

| 分組 | 修復標題 | 嚴重度 | 影響端 |
|---|---|---|---|
| **A** | H1 Hero 字級過大、手機端斷字破碎 | 🔴 致命 | 手機端 |
| **B** | +100 PP 漂浮徽章溢出手機視窗 | 🔴 致命 | 手機端 |
| **C** | Dark mode 主 CTA 按鈕幾乎隱形 | 🔴 致命 | 雙端（Dark 特別嚴重） |
| **D** | Dark mode Brand 色 `#6B8AFF` 略帶霓虹感 | 🟠 中 | Dark mode |
| **E** | Section 垂直 padding 過鬆，手機需滾 3 屏才見 CTA | 🟠 中 | 手機端 |
| **F** | Light mode 主 CTA 視覺重量不足（與 mock 卡相等） | 🟠 中 | Light mode |
| **G** | Feature Cards 三種 Accent 色並列，破壞品牌色紀律 | 🟡 低 | 雙端 |
| **H** | Login H1 `text-[26px]` 偏小，Hero 氣勢不足 | 🟡 低 | 雙端 |
| **I** | `:focus-visible` 飽和度偏高 | ⚪ 輕 | 雙端 |
| **J** | 中文字體共用 `letter-spacing: -0.01em` | ⚪ 輕 | 雙端 |

---

## ── 分組 A｜Hero H1 字級響應式修正

**檔案**：`src/app/waitlist/page.tsx`
**目標**：H1 在手機 375px 從 `text-4xl` (36px) 降至 `text-[28px]`，加 `sm:` 中間斷點

### Step A.1｜修正 Hero H1 字級

**搜尋目標（原值）**：
```tsx
className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-balance"
```

**改為**：
```tsx
className="text-[28px] sm:text-4xl md:text-5xl font-bold tracking-tight mb-6 text-balance"
```

### Step A.2｜同步修正 H2 字級與下方留白

**搜尋目標（原值）**：
```tsx
className="text-base md:text-lg leading-relaxed mb-16 max-w-xl mx-auto text-balance"
```

**改為**（降低 H2 在 mobile 的尺寸與 mb）：
```tsx
className="text-[15px] sm:text-base md:text-lg leading-relaxed mb-12 md:mb-16 max-w-xl mx-auto text-balance"
```

### Step A.3｜驗證

完成後檢查：
- 手機 375px：H1 28px，`mb-12` = 48px
- Desktop：H1 `md:text-5xl`，`mb-16` = 64px

---

## ── 分組 B｜+100 PP 漂浮徽章手機端溢位修正

**檔案**：`src/app/waitlist/page.tsx`
**目標**：Mobile 收回容器內，Desktop 才往外飄

### Step B.1｜找出 Framer Motion motion.div 徽章

**搜尋目標**（約在 line 202-212）：
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.5, x: 40, y: -20 }}
  animate={{ opacity: 1, scale: 1, x: 40, y: -20 }}
  transition={{ duration: 0.6, delay: 0.8, type: "spring", stiffness: 200 }}
  className="absolute -top-2 -right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
  ...
```

### Step B.2｜加上 sm: 斷點

**改為**：
```tsx
className="absolute top-2 right-2 sm:absolute sm:-top-2 sm:-right-8 sm:flex flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
```

同時移除 Framer Motion 的 `x: 40, y: -20` 在 mobile 時的疊加：
```tsx
// 改 motion.div 的 animate：
initial={{ opacity: 0, scale: 0.5 }}
animate={{ opacity: 1, scale: 1 }}
// 移掉 x: 40, y: -20（讓它在 sm: 才生效）
```

---

## ── 分組 C｜Dark Mode 主 CTA 視覺重量修正

**檔案**：`src/app/waitlist/page.tsx`
**目標**：Dark mode 下 CTA 從「白底淺邊框」改為「品牌色填滿」

### Step C.1｜找出主 CTA 按鈕

**搜尋目標**（約在 line 283-289）：
```tsx
<button
  onClick={handleGoogleLogin}
  disabled={loading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
  className="w-full py-4 px-6 rounded-2xl text-[15px] font-semibold transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] cursor-pointer"
  style={{
    background: loading ? "var(--surface-muted)" : "var(--surface-elevated)",
    border: "2px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    color: "var(--text-primary)",
  }}
>
```

### Step C.2｜改用品牌色填滿（不分 light/dark 一致）

**改為**：
```tsx
<button
  onClick={handleGoogleLogin}
  disabled={loading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
  className="w-full py-4 px-6 rounded-2xl text-[15px] font-semibold transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] cursor-pointer"
  style={{
    background: loading ? "var(--surface-muted)" : "var(--brand)",
    color: "var(--brand-foreground)",
    boxShadow: "0 8px 24px rgba(var(--brand-rgb), 0.25)",
    border: "none",
  }}
>
```

### Step C.3｜同步移除 `hover:opacity-90`（品牌色夠重，疊 opacity 視覺乾擾）

```tsx
className="w-full py-4 px-6 rounded-2xl text-[15px] font-semibold transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
```

---

## ── 分組 D｜Dark mode Brand 色微降飽和度

**檔案**：`src/app/globals.css`
**目標**：Dark mode `--brand: #6B8AFF` → `#8195F8`（降藍增加灰）

### Step D.1｜找出 Dark mode brand 色

**搜尋目標**：
```css
[data-theme="dark"] {
  ...
  --brand: #6B8AFF;
  --brand-rgb: 107 138 255;
  --brand-hover: #8BA3FF;
```

### Step D.2｜改為微灰化 brand

```css
[data-theme="dark"] {
  ...
  --brand: #8195F8;
  --brand-rgb: 129 149 248;
  --brand-hover: #95A7F8;
```

### Step D.3｜同步更新 FAB dark mode 色（若沿用）

搜尋 `fab` 內的 `background: #A78BFA` 是否在 dark mode 有單獨覆寫，如有則同步調整。

---

## ── 分組 E｜Section 垂直 Padding 收斂

**檔案**：`src/app/waitlist/page.tsx`
**目標**：Mobile section padding `py-24` → `py-14`（96px → 56px）

### Step E.1｜找出所有 Hero Section 外的 section

**搜尋目標（第一個 section）**：
```tsx
<section className="relative z-10 px-4 py-24 md:py-32">
```

### Step E.2｜改為

```tsx
<section className="relative z-10 px-4 py-14 md:py-24">
```

### Step E.3｜找出第二個 section

**搜尋目標**：
```tsx
<section className="relative z-10 px-4 py-24 md:py-32">
```

### Step E.4｜改為

```tsx
<section className="relative z-10 px-4 py-14 md:py-24">
```

---

## ── 分組 F｜Light mode 主 CTA 與 Dark Mode 同步（已由 C 覆蓋）

> **說明**：Step C 已將 CTA 改為品牌色填滿，Light mode 同步修正，無需額外 Step。
> 若希望 Light mode 維持「極簡灰底」風格，則跳過 C，只在 C 的 `style` 中加條件判斷：
> ```tsx
> style={{
>   background: loading ? "var(--surface-muted)"
>     : isDark ? "var(--brand)" : "var(--surface-elevated)",
>   ...
> }}
> ```
> 但評審建議：**統一品牌色填滿**，是更明確的 UI 表達。

---

## ── 分組 G｜Feature Cards Icon 色紀律統一

**檔案**：`src/app/waitlist/page.tsx`
**目標**：三張 Feature Card 的 Icon 背景色統一為 `--brand-tint`（移除 `#f59e0b` / `#a78bfa` 直接引用）

### Step G.1｜找出三張 Feature Card 的 icon container

**Card 1（獨自升級）原值**：
```tsx
style={{ background: "rgba(245,158,11,0.12)" }}
```

**Card 2（禪模式）原值**：
```tsx
style={{ background: "rgba(59,130,246,0.12)" }}
```

**Card 3（溫柔退場）原值**：
```tsx
style={{ background: "rgba(167,139,250,0.12)" }}
```

### Step G.2｜統一改為 brand tint

三張卡片全部改為：
```tsx
style={{ background: "var(--brand-tint)" }}
```

### Step G.3｜Icon 顏色同步改為 brand 色

**Card 1 原值**：
```tsx
style={{ color: "#f59e0b" }}
```

**改為**：
```tsx
style={{ color: "var(--brand)" }}
```

**Card 3 原值**：
```tsx
style={{ color: "#a78bfa" }}
```

**改為**：
```tsx
style={{ color: "var(--brand)" }}
```

（Card 2 原本已用 `var(--brand)`，無需改）

---

## ── 分組 H｜Login Page H1 字級提升

**檔案**：`src/components/LandingPage.tsx`
**目標**：H1 `text-[26px]` → `text-[28px]`，加 `sm:` 斷點

### Step H.1｜找出 H1

**搜尋目標**：
```tsx
<h1
  className="text-[26px] font-semibold leading-snug text-balance"
  style={{ color: "var(--text-primary)" }}
>
```

### Step H.2｜改為

```tsx
<h1
  className="text-[28px] sm:text-[30px] font-semibold leading-snug text-balance"
  style={{ color: "var(--text-primary)" }}
>
```

### Step H.3｜副標「Beta 公測中」字級提升

**搜尋目標**：
```tsx
<span className="text-[11px]">Beta 公測中。</span>
```

**改為**：
```tsx
<span className="text-[12px]">Beta 公測中。</span>
```

---

## ── 分組 I｜Focus Ring 柔化

**檔案**：`src/app/globals.css`
**目標**：`:focus-visible` 的 outline 從 100% 飽和改為 50%

### Step I.1｜找出現有 focus-visible

**搜尋目標**：
```css
:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### Step I.2｜改為

```css
:focus-visible {
  outline: 2px solid rgba(var(--brand-rgb), 0.5);
  outline-offset: 2px;
  border-radius: 4px;
}
```

---

## ── 分組 J｜中文 Letter Spacing 修正

**檔案**：`src/app/globals.css`
**目標**：中文不套用 `-0.01em`，英文保留緊緻感

### Step J.1｜在 `@layer base` 的 body 規則之後加入

```css
/* 中文不使用負 letter-spacing，保持筆劃清晰 */
body:lang(zh-TW) {
  letter-spacing: 0;
}
body:lang(zh-CN) {
  letter-spacing: 0;
}
```

### Step J.2｜或透過 CSS 屬性選擇器（更廣覆蓋）

```css
/* 對所有中文內容容器覆寫 */
[lang="zh-TW"],
[lang="zh-CN"],
.zh {
  letter-spacing: 0;
}
```

---

## 實作順序建議（低風險→高風險）

```
Step J（J → globals.css，風險最低）─→ Step I（J → globals.css）
        ↓
Step H（H → LandingPage.tsx，單一元件）─→ Step G（G → waitlist/page.tsx）
        ↓
Step D（D → globals.css Dark mode token）
        ↓
Step A（A → waitlist/page.tsx H1）
        ↓
Step E（E → waitlist/page.tsx padding）
        ↓
Step B（B → waitlist/page.tsx 浮動徽章）
        ↓
Step C（C → waitlist/page.tsx CTA 按鈕）
        ↓
tsc --noEmit + npm run build（驗證全量）
```

---

## 最終驗收標準

| 項目 | 預期結果 |
|---|---|
| `npm run build` | build success |
| `npx tsc --noEmit` | 0 errors |
| **手機 375px** Hero H1 | ≤ 28px，不在「效率｜工具」處硬斷行 |
| **手機 375px** +100 PP 徽章 | 完全可見，不溢出 viewport 右側 |
| **Dark mode** 主 CTA 按鈕 | 品牌色填滿 `#4F6AF5`，非隱形灰 |
| **Dark mode** 登入頁 CTA | 品牌色 `#8195F8`，無霓虹眩光 |
| **手機** Section 垂直空間 | Hero → Features → CTA 滾動不超過 2 屏 |
| **雙端** Feature Cards | 三張統一 brand-tint + brand icon，無三色 Accent 並列 |
| **雙端** Login H1 | ≥ 28px，sm: 30px |
| **雙端** `:focus-visible` | 柔化半透明輪廓，無刺眼亮邊 |
| **雙端** 中文 | `letter-spacing: 0`，筆劃不黏連 |

---

## 部署後確認（截圖比對）

1. **Light mode 手機 375px** `/waitlist` → 全頁截圖確認 H1 無破碎斷行、CTA 完整可見
2. **Dark mode 手機 375px** `/waitlist` → 全頁截圖確認 CTA 有品牌色填滿
3. **Dark mode 桌面 1440px** `/login` → CTA 按鈕無眩光
4. **Light mode 桌面** `/waitlist` → 三張 Feature Card 統一藍色調

---

## 完整依賴關係圖

```
J (globals.css letter-spacing)
        ↓
I (globals.css focus-visible)
        ↓
H (LandingPage.tsx 字級)
G (waitlist/page.tsx Feature Cards)
        ↓
D (globals.css Dark brand 色)
        ↓
A (waitlist/page.tsx H1)
        ↓
E (waitlist/page.tsx padding)
        ↓
B (waitlist/page.tsx 浮動徽章)
        ↓
C (waitlist/page.tsx CTA) ──── 全量驗證 ────→ Deploy
```
