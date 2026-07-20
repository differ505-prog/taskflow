/**
 * /api/tags/rename — 全域標籤重新命名
 *
 * 用途：批次更新所有任務中指定標籤的名稱
 *
 * Request:
 *   POST /api/tags/rename
 *   { "oldName": "work", "newName": "工作" }
 *
 * Response:
 *   { "success": true, "updatedCount": 15 }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // 從 cookie 取得 session（API Route = Server Component）
    const supabaseClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
      },
    });

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { oldName, newName } = await req.json();

    if (!oldName || !newName || oldName === newName) {
      return NextResponse.json({ error: "Invalid names" }, { status: 400 });
    }

    if (oldName.length > 50 || newName.length > 50) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }

    // 取得用戶所有任務
    const { data: tasks, error: fetchError } = await supabaseClient
      .from("personal_tasks")
      .select("data")
      .eq("owner_uid", user.id);

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    // 過濾並更新含有 oldName 的任務
    const tasksToUpdate: unknown[] = [];
    let updatedCount = 0;

    for (const row of tasks ?? []) {
      const task = row.data as { tags?: string[] };
      if (task?.tags && Array.isArray(task.tags)) {
        const tagIndex = task.tags.indexOf(oldName);
        if (tagIndex !== -1) {
          const updatedTags = [...task.tags];
          updatedTags[tagIndex] = newName;
          tasksToUpdate.push({
            ...row,
            data: { ...task, tags: updatedTags },
          });
          updatedCount++;
        }
      }
    }

    // 批量更新
    if (tasksToUpdate.length > 0) {
      const { error: updateError } = await supabaseClient
        .from("personal_tasks")
        .upsert(tasksToUpdate);

      if (updateError) {
        console.error("[api/tags/rename] Update error:", updateError);
        return NextResponse.json({ error: "Failed to update tasks" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (err) {
    console.error("[api/tags/rename] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
