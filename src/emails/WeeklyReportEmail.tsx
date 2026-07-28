"use client";

/**
 * 模板 B：【狀態窗】週末戰報
 *
 * 觸發條件：每週五下午，僅發給當週有活躍的用戶
 * 設計原則：
 *   - 暗色系 RPG 狀態窗風格，綠色高光數字
 *   - 無任何未完成任務列表（🚫 禁止地雷）
 *   - 深色模式優先（呼應 RPG 暗色美學）
 *   - 輕鬆正向，無壓力，專注在「你做了什麼」而非「你沒做什麼」
 *
 * §26 新增根因類別：Q「防禦性 CS 郵件系統」
 */

import {
  Body,
  Container,
  Text,
  Link,
  Tailwind,
} from "@react-email/components";
import { render } from "@react-email/render";

interface WeeklyReportEmailProps {
  userName?: string;
  weekPp?: number;        // 本週獲得的 PP（純數字，供視覺高光用）
  completedTaskCount?: number; // 本週完成任務數（可選，未提供則不顯示）
  usedAiCrusher?: boolean;  // 是否用過 AI 任務粉碎機
}

export function WeeklyReportEmail({
  userName = "辛苦了！",
  weekPp = 0,
  completedTaskCount,
  usedAiCrusher = false,
}: WeeklyReportEmailProps) {
  return (
    <Tailwind
      config={{
        theme: {
          screens: { all: {} },
          theme: {
            colors: {
              // RPG 暗色系色票
              bgDeep: "#0d0d1a",
              bgCard: "#14142b",
              bgCardHighlight: "#1e1e3f",
              border: "#2a2a5c",
              borderGlow: "#3d3d8a",
              textPrimary: "#e0e0ff",
              textSecondary: "#8888cc",
              textMuted: "#5555aa",
              expGreen: "#4ade80",   // 經驗值高光（綠）
              expGreenMuted: "#22543d",
              accentPurple: "#a78bfa", // 強調色（溫柔紫）
              statusBar: "#1a1a3a",
            },
          },
        },
      }}
    >
      <Body
        style={{
          backgroundColor: "#0d0d1a",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "Courier New", monospace',
        }}
      >
        <Container
          style={{
            backgroundColor: "#0d0d1a",
            padding: "32px 20px",
            maxWidth: "440px",
          }}
        >
          {/* ══════════════════════════════════════
              RPG 狀態窗頂部 — 等寬方框美學
          ══════════════════════════════════════ */}

          {/* ── 狀態窗外框 ─────────────────────── */}
          <Container
            style={{
              backgroundColor: "#14142b",
              border: "1px solid #2a2a5c",
              borderRadius: "8px",
              padding: "24px 20px",
              marginBottom: "20px",
            }}
          >
            {/* 狀態窗標題欄 */}
            <Container
              style={{
                backgroundColor: "#1e1e3f",
                borderBottom: "1px solid #2a2a5c",
                padding: "10px 16px",
                marginBottom: "20px",
                borderRadius: "4px 4px 0 0",
              }}
            >
              <Text
                style={{
                  color: "#a78bfa",
                  fontSize: "13px",
                  fontWeight: "700",
                  fontFamily: '"Courier New", monospace',
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                ✨ 本週專注戰報
              </Text>
            </Container>

            {/* 狀態列：用戶名稱 */}
            <Text
              style={{
                color: "#8888cc",
                fontSize: "11px",
                fontFamily: '"Courier New", monospace',
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              等級稱號
            </Text>
            <Text
              style={{
                color: "#e0e0ff",
                fontSize: "18px",
                fontWeight: "700",
                fontFamily: '"Courier New", monospace',
                marginBottom: "20px",
              }}
            >
              {userName}
            </Text>

            {/* 分隔線 */}
            <Container
              style={{
                borderTop: "1px dashed #2a2a5c",
                marginBottom: "20px",
              }}
            />

            {/* ═══ 核心狀態列 ════════════════════ */}

            {/* PP 獲得 */}
            <Container
              style={{
                backgroundColor: "#14142b",
                border: "1px solid #22543d",
                borderRadius: "6px",
                padding: "14px 16px",
                marginBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "#8888cc",
                  fontSize: "12px",
                  fontFamily: '"Courier New", monospace',
                  letterSpacing: "0.5px",
                  margin: 0,
                }}
              >
                本週經驗值
              </Text>
              <Text
                style={{
                  color: "#4ade80",
                  fontSize: "24px",
                  fontWeight: "700",
                  fontFamily: '"Courier New", monospace',
                  margin: 0,
                  textShadow: "0 0 12px rgba(74, 222, 128, 0.4)",
                }}
              >
                +{weekPp.toLocaleString()}
              </Text>
            </Container>

            {/* 完成任務數（可選） */}
            {completedTaskCount !== undefined && (
              <Container
                style={{
                  backgroundColor: "#14142b",
                  border: "1px solid #2a2a5c",
                  borderRadius: "6px",
                  padding: "12px 16px",
                  marginBottom: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#8888cc",
                    fontSize: "12px",
                    fontFamily: '"Courier New", monospace',
                    margin: 0,
                  }}
                >
                  任務完成數
                </Text>
                <Text
                  style={{
                    color: "#e0e0ff",
                    fontSize: "18px",
                    fontWeight: "700",
                    fontFamily: '"Courier New", monospace',
                    margin: 0,
                  }}
                >
                  {completedTaskCount}
                </Text>
              </Container>
            )}

            {/* AI 任務粉碎機（若使用過） */}
            {usedAiCrusher && (
              <Container
                style={{
                  backgroundColor: "#14142b",
                  border: "1px solid #3d3d8a",
                  borderRadius: "6px",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <Text
                  style={{
                    color: "#a78bfa",
                    fontSize: "16px",
                    margin: 0,
                  }}
                >
                  ✦
                </Text>
                <Text
                  style={{
                    color: "#e0e0ff",
                    fontSize: "13px",
                    fontFamily: '"Courier New", monospace',
                    margin: 0,
                  }}
                >
                  你把一個複雜任務丟進了 AI 任務粉碎機
                </Text>
              </Container>
            )}

            {/* 底部狀態條 */}
            <Container
              style={{
                backgroundColor: "#1a1a3a",
                borderRadius: "4px",
                padding: "8px 16px",
                marginTop: "20px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: "#5555aa",
                  fontSize: "10px",
                  fontFamily: '"Courier New", monospace',
                  letterSpacing: "1px",
                  margin: 0,
                }}
              >
                VIBELIST GUILD
              </Text>
              <Text
                style={{
                  color: "#5555aa",
                  fontSize: "10px",
                  fontFamily: '"Courier New", monospace',
                  margin: 0,
                }}
              >
                {new Date().getFullYear()}
              </Text>
            </Container>
          </Container>

          {/* ══════════════════════════════════════
              結語區
          ══════════════════════════════════════ */}

          <Text
            style={{
              color: "#8888cc",
              fontSize: "14px",
              lineHeight: "1.7",
              marginBottom: "12px",
              textAlign: "center",
            }}
          >
            週末到了，請完全忘記工作，好好享受現實世界的多巴胺吧。
          </Text>

          <Text
            style={{
              color: "#5555aa",
              fontSize: "13px",
              lineHeight: "1.7",
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            下週我們大廳見。
          </Text>

          {/* 連結 */}
          <Container style={{ textAlign: "center", marginBottom: "32px" }}>
            <Link
              href="https://vibelist.app/zen"
              style={{
                display: "inline-block",
                color: "#a78bfa",
                fontSize: "14px",
                fontWeight: "500",
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              }}
            >
              下週再來 →
            </Link>
          </Container>

          {/* 底部版權（暗色） */}
          <Text
            style={{
              color: "#252540",
              fontSize: "11px",
              marginTop: "32px",
              marginBottom: "0",
              textAlign: "center",
            }}
          >
            此郵件由 VibeList 系統自動寄出，絕對不會告訴你「你本週沒做到的事」。
          </Text>
        </Container>
      </Body>
    </Tailwind>
  );
}

/**
 * 供 API Route / Edge Function 呼叫的 render helper
 */
export async function renderWeeklyReportEmail(props: WeeklyReportEmailProps) {
  return {
    html: await render(<WeeklyReportEmail {...props} />, { pretty: true }),
    text: await render(<WeeklyReportEmail {...props} />, { plainText: true }),
  };
}
