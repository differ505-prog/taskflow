import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    // 簡單的 Email 驗證
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "請輸入有效的 Email" },
        { status: 400 }
      );
    }

    // 目前處於 MVP 階段，簡單存入 localStorage 作為示範
    // 生產環境應該串接真正的 Email 行銷工具（如 ConvertKit、Mailchimp）
    const waitlistKey = "vibelist_waitlist";
    const existing = JSON.parse(
      typeof window !== "undefined"
        ? localStorage.getItem(waitlistKey) || "[]"
        : "[]"
    );

    if (existing.includes(email)) {
      return NextResponse.json(
        { message: "你已經在名單裡了 ✨", alreadyJoined: true },
        { status: 200 }
      );
    }

    existing.push(email);
    if (typeof window !== "undefined") {
      localStorage.setItem(waitlistKey, JSON.stringify(existing));
    }

    // 印出後端日誌方便 Debug（實際部署後應移除）
    console.log(`[Waitlist] New signup: ${email} (Total: ${existing.length})`);

    return NextResponse.json({
      message: "報名成功！我們會在開放時第一時間通知你 🎉",
      total: existing.length,
    });
  } catch {
    return NextResponse.json(
      { error: "系統忙碌中，請稍後再試" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Waitlist API is running",
  });
}
