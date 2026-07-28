"use client";

/**
 * 模板 A：【無罪赦免】喚回信
 *
 * 觸發條件：3 天未登入
 * 設計原則：
 *   - 純文字私人信件風格，像朋友寄來的信
 *   - 零焦慮：無紅字、無警告圖示、不列未完成任務
 *   - 呼應「Pro 等級」世界觀但保持溫暖
 *   - 深色模式支援（信件多在郵箱深色主題下閱讀）
 *
 * §26 新增根因類別：Q「防禦性 CS 郵件系統」
 */

import {
  Body,
  Container,
  Hr,
  Text,
  Link,
  Tailwind,
} from "@react-email/components";
import { render } from "@react-email/render";

interface AmnestiaEmailProps {
  userName?: string; // 顯示名稱，無則用「朋友」
  lastActiveDays: number; // 距上次活躍天數
}

export function AmnestiaEmail({
  userName = "朋友",
  lastActiveDays = 3,
}: AmnestiaEmailProps) {
  return (
    <Tailwind
      config={{
        theme: {
          screens: { all: {} },
          theme: {
            colors: {
              // 深色模式專用色票（郵箱 dark mode 背景 #1a1a2e）
              surface: "#1a1a2e",
              surfaceCard: "#252542",
              textPrimary: "#e8e8f0",
              textSecondary: "#9090b0",
              accent: "#7c8cf8", // 溫柔紫藍
              accentMuted: "#4a4a7a",
            },
          },
        },
      }}
    >
      <Body
        style={{
          backgroundColor: "#1a1a2e",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        }}
      >
        <Container
          style={{
            backgroundColor: "#1a1a2e",
            padding: "40px 32px",
            maxWidth: "560px",
          }}
        >
          {/* ── 問候語 ───────────────────────────── */}
          <Text
            style={{
              color: "#e8e8f0",
              fontSize: "22px",
              fontWeight: "600",
              marginBottom: "28px",
              letterSpacing: "-0.3px",
            }}
          >
            嗨 {userName}，
          </Text>

          {/* ── 主文第一段 ────────────────────────── */}
          <Text
            style={{
              color: "#9090b0",
              fontSize: "16px",
              lineHeight: "1.75",
              marginBottom: "20px",
            }}
          >
            我注意到你這幾天沒有來到 VibeList 的任務大廳。
          </Text>

          <Text
            style={{
              color: "#e8e8f0",
              fontSize: "16px",
              lineHeight: "1.75",
              marginBottom: "28px",
            }}
          >
            我寫這封信只是想告訴你：
          </Text>

          {/* ── 核心訊息（大字強調）───────────────── */}
          <Text
            style={{
              color: "#7c8cf8",
              fontSize: "20px",
              fontWeight: "700",
              lineHeight: "1.6",
              marginBottom: "28px",
              letterSpacing: "-0.2px",
            }}
          >
            這完全沒關係。
          </Text>

          {/* ── 主文第二段 ────────────────────────── */}
          <Text
            style={{
              color: "#9090b0",
              fontSize: "16px",
              lineHeight: "1.75",
              marginBottom: "20px",
            }}
          >
            大腦需要重置，現實生活有時就是會讓我們手忙腳亂。
          </Text>

          <Text
            style={{
              color: "#9090b0",
              fontSize: "16px",
              lineHeight: "1.75",
              marginBottom: "28px",
            }}
          >
            在 Pro 等級系統裡，沒有「進度落後」這回事。你的 PP 永遠都在那裡，
            不會倒扣，也不會有人催促你。
          </Text>

          {/* ── 分隔線 ───────────────────────────── */}
          <Hr
            style={{
              borderColor: "#252542",
              marginBottom: "28px",
            }}
          />

          {/* ── CTA 引導語 ───────────────────────── */}
          <Text
            style={{
              color: "#9090b0",
              fontSize: "16px",
              lineHeight: "1.75",
              marginBottom: "16px",
            }}
          >
            當你準備好的時候，你的禪模式隨時為你敞開。
          </Text>

          <Text
            style={{
              color: "#9090b0",
              fontSize: "16px",
              lineHeight: "1.75",
              marginBottom: "28px",
            }}
          >
            今天就算只上去按一下「無罪赦免」清空過期清單，
            都是一次很棒的勝利。
          </Text>

          {/* ── 連結按鈕（溫和樣式）─────────────── */}
          <Container style={{ textAlign: "center", marginBottom: "36px" }}>
            <Link
              href="https://vibelist.app/zen"
              style={{
                display: "inline-block",
                color: "#7c8cf8",
                fontSize: "15px",
                fontWeight: "500",
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              }}
            >
              回大廳看看 →
            </Link>
          </Container>

          {/* ── 結尾 ─────────────────────────────── */}
          <Text
            style={{
              color: "#4a4a7a",
              fontSize: "14px",
              lineHeight: "1.6",
              marginBottom: "8px",
            }}
          >
            祝你有個平靜的一天。
          </Text>

          <Text
            style={{
              color: "#4a4a7a",
              fontSize: "14px",
              fontWeight: "600",
              letterSpacing: "0.5px",
            }}
          >
            — VibeList 創辦人
          </Text>

          {/* ── 底部留白 ─────────────────────────── */}
          <Text
            style={{
              color: "#252542",
              fontSize: "11px",
              marginTop: "48px",
              marginBottom: "0",
            }}
          >
            此郵件由 VibeList 系統自動寄出，你不會再因為「太久沒來」而收到類似郵件。
            如有疑問請回信告知我們。
          </Text>
        </Container>
      </Body>
    </Tailwind>
  );
}

/**
 * 供 API Route / Edge Function 呼叫的 render helper
 * 預覽時 render(html) 可直接打開；render(text) 供無圖形郵件客戶端
 */
export async function renderAmnestiaEmail(props: AmnestiaEmailProps) {
  return {
    html: await render(<AmnestiaEmail {...props} />, { pretty: true }),
    text: await render(<AmnestiaEmail {...props} />, { plainText: true }),
  };
}
