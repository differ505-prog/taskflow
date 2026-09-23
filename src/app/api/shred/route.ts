/**
 * /api/shred — AI 任務粉碎機 (AI Task Shredder)
 *
 * 用途：把單一任務標題拆解為 3-5 個極微小、無腦、單向線性的子步驟
 *       專為 ADHD 啟動癱瘓設計:第一步必須是物理/畫面上最簡單的動作
 *
 * Request:
 *   POST /api/shred
 *   { "title": "寫完期末報告" }
 *
 * Response:
 *   { "success": true, "steps": ["打開 Word", "建立新檔案", "..."] }
 *
 * 設計重點:
 * 1. Server-side 持有 GEMINI_API_KEY (絕不外洩,§8 資安)
 * 2. response_mime_type: "application/json" 強制 JSON 輸出
 *    加上 system prompt 明確要求,雙保險避免 Markdown 包裹
 * 3. 401/400/500 標準錯誤流,沿用 codebase 慣例
 * 4. 限流:為避免 LLM 成本失控,server-side 也做 IP rate limit
 *    (前端 localStorage 每天 3 次是「友善提示」,server-side 是「真正防線」)
 */
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerClient } from "@supabase/ssr";
import { incrementAndCheckQuota } from "@/lib/quota-monitor";
import { checkRateLimit } from "@/lib/rate-limit";

// ─── System Prompt (來自需求) ───
const SYSTEM_PROMPT = `你是一個專為 ADHD 嚴重患者設計的任務拆解助理。你的唯一目標是打破用戶的『啟動癱瘓』。當用戶提供一個任務時，請將其拆解為 3 到 5 個『極度微小、無腦、且具備單向線性順序』的步驟。第一步必須是物理上或畫面上最簡單的動作（例如：打開某個軟體、拿出一支筆）。請只回傳 JSON 格式，不要包含 Markdown 語法或其他廢話。格式如：{ "steps": ["步驟1", "步驟2"] }`;

// ─── 取得 client IP (Next.js 標準) ───
function getClientIp(req: NextRequest): string {
  // Vercel / proxy 環境下 x-forwarded-for 第一個是 client IP
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// ─── 驗證登入 (沿用 tags/rename pattern,需要 Supabase auth) ───
async function getAuthedUser(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  try {
    // 1. 驗證登入
    const user = await getAuthedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. IP rate limit (60s window) + User daily limit (24h window)
    const ip = getClientIp(req);
    const { allowed: ipAllowed } = await checkRateLimit(`shred:ip:${ip}`, 10, 60_000);
    if (!ipAllowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. 請稍後再試。" },
        { status: 429 }
      );
    }
    const { allowed: userAllowed } = await checkRateLimit(`shred:user:${user.id}`, 30, 24 * 60 * 60 * 1000);
    if (!userAllowed) {
      return NextResponse.json(
        { error: "今日使用次數已達上限（30次/天），請明天再試。" },
        { status: 429 }
      );
    }

    // 3. 解析 body
    const body = await req.json();
    const { title } = body as { title?: string };

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "任務標題不可為空" }, { status: 400 });
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 200) {
      return NextResponse.json(
        { error: "任務標題過長,請縮短至 200 字以內" },
        { status: 400 }
      );
    }

    // 4. 檢查 API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[api/shred] GEMINI_API_KEY not configured");
      // 主動通知 Discord（利用既有 quota-monitor warnDiscord 機制）
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL_FOR_QUOTA;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "🚨 **[TaskFlow]** GEMINI_API_KEY 未設定，AI 任務粉碎機已停用",
          }),
        }).catch(() => {});
      }
      return NextResponse.json(
        { error: "AI 服務尚未設定,請聯繫管理員" },
        { status: 503 }
      );
    }

    // 5. 用量監控（超限擋掉，防止成本失控）
    const { allowed, currentCount, limit } = await incrementAndCheckQuota("gemini");
    if (!allowed) {
      return NextResponse.json(
        { error: "今日 AI 使用次數已達上限，請明天再試" },
        { status: 429 }
      );
    }

    // 6. 呼叫 Gemini 1.5 Flash
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7, // 中等創造性,讓步驟有變化但不離譜
        maxOutputTokens: 512, // 3-5 個步驟綽綽有餘
      },
    });

    const result = await model.generateContent(trimmedTitle);
    const responseText = result.response.text();

    // 7. 解析 JSON (雙保險:即使 model 回傳 Markdown 包裹,也嘗試解析)
    let steps: string[] = [];
    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed.steps)) {
        steps = parsed.steps
          .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s: string) => s.trim())
          .slice(0, 5); // 強制上限 5
      }
    } catch {
      // fallback:嘗試從 Markdown code block 中提取 JSON
      const match = responseText.match(/\{[\s\S]*"steps"[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed.steps)) {
            steps = parsed.steps
              .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
              .map((s: string) => s.trim())
              .slice(0, 5);
          }
        } catch {
          // 真的解析失敗
        }
      }
    }

    // 8. 驗證至少有 3 個步驟 (防呆)
    if (steps.length < 3) {
      console.warn("[api/shred] Insufficient steps from model:", responseText);
      return NextResponse.json(
        { error: "AI 回應格式異常,請重試一次" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, steps });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/shred] Error:", errorMessage);
    return NextResponse.json(
      { error: "AI 服務暫時無法使用,請稍後再試" },
      { status: 500 }
    );
  }
}
