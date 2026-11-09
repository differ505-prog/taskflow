#!/usr/bin/env node
/**
 * scripts/agent-cli.ts — Antigravity Agent CLI
 * 讓 AI 或本機開發者直接讀取、新增、編輯習慣與任務。
 *
 * 用法範例：
 *   npx tsx scripts/agent-cli.ts list habits
 *   npx tsx scripts/agent-cli.ts add habit "晨間靜坐 30 分鐘" --minutes 30
 *   npx tsx scripts/agent-cli.ts checkin habit "晨間靜坐" --minutes 30
 *   npx tsx scripts/agent-cli.ts list tasks
 *   npx tsx scripts/agent-cli.ts add task "完成台股回測報告" --priority do-now
 */

import http from "http";
import https from "https";
import fs from "fs";
import path from "path";

const API_BASE = process.env.AGENT_API_URL || "https://www.vibelist.work/api/agent";
const API_KEY = process.env.AGENT_API_KEY || "vibelist-agent-key-2026";
const STATE_FILE_PATH = path.join(process.cwd(), ".data", "user_state.json");

interface RequestOptions {
  method?: string;
  endpoint?: string;
  body?: any;
}

async function callAgentApi(opts: RequestOptions = {}): Promise<any> {
  const urlStr = `${API_BASE}${opts.endpoint || ""}`;
  const parsedUrl = new URL(urlStr);
  const isHttps = parsedUrl.protocol === "https:";
  const client = isHttps ? https : http;

  const payload = opts.body ? JSON.stringify(opts.body) : null;

  return new Promise((resolve, reject) => {
    const req = client.request(
      parsedUrl,
      {
        method: opts.method || (payload ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          "x-agent-key": API_KEY,
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch {
            resolve({ raw: data, statusCode: res.statusCode });
          }
        });
      }
    );

    req.on("error", (err) => {
      // 若本機伺服器未啟動，fallback 至讀取本機鏡像檔案
      if (opts.method === "GET" || !opts.method) {
        if (fs.existsSync(STATE_FILE_PATH)) {
          try {
            const content = fs.readFileSync(STATE_FILE_PATH, "utf-8");
            return resolve(JSON.parse(content));
          } catch {}
        }
      }
      reject(err);
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function parseArgs(args: string[]) {
  const parsed: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, options: parsed };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const { positional, options } = parseArgs(rawArgs);

  const command = positional[0]?.toLowerCase();
  const subCommand = positional[1]?.toLowerCase();
  const targetName = positional[2];

  if (!command || command === "help") {
    console.log(`
Antigravity Agent CLI ── 任務與習慣互動工具

指令列表：
  npx tsx scripts/agent-cli.ts list habits          # 列出所有習慣
  npx tsx scripts/agent-cli.ts list tasks           # 列出所有待辦任務
  npx tsx scripts/agent-cli.ts add habit <標題>      # 新增習慣 (--minutes 30 --color #4F6AF5)
  npx tsx scripts/agent-cli.ts checkin habit <名稱>  # 習慣打卡 (--minutes 30)
  npx tsx scripts/agent-cli.ts add task <標題>       # 新增任務 (--priority do-now)
  npx tsx scripts/agent-cli.ts complete task <名稱>  # 完成任務
`);
    return;
  }

  try {
    // 1. LIST
    if (command === "list") {
      if (subCommand === "habits" || !subCommand) {
        const res = await callAgentApi({ endpoint: "?type=habits" });
        const habits = res.habits || [];
        console.log(`\n📋 習慣清單 (共 ${habits.length} 個)：`);
        console.table(
          habits.map((h: any) => ({
            ID: h.id,
            標題: h.title,
            每日目標: h.dailyTarget?.minutes ? `${h.dailyTarget.minutes} 分鐘` : "-",
            連續天數: `${h.streak} 天`,
            總打卡數: h.checkins?.length || 0,
            上次紀錄: h.lastRecordedAt ? h.lastRecordedAt.slice(0, 16).replace("T", " ") : "-",
          }))
        );
      }
      if (subCommand === "tasks") {
        const res = await callAgentApi({ endpoint: "?type=tasks" });
        const tasks = res.tasks || [];
        console.log(`\n✅ 任務清單 (共 ${tasks.length} 個)：`);
        console.table(
          tasks.map((t: any) => ({
            ID: t.id,
            標題: t.title,
            狀態: t.status,
            優先級: t.priority,
            截止日: t.dueDate || "-",
          }))
        );
      }
      return;
    }

    // 2. ADD HABIT
    if (command === "add" && subCommand === "habit") {
      const title = targetName || (options.title as string);
      if (!title) {
        console.error("❌ 請指定習慣標題：npx tsx scripts/agent-cli.ts add habit <標題>");
        return;
      }
      const minutes = options.minutes ? parseInt(options.minutes as string, 10) : undefined;
      const color = (options.color as string) || "#4F6AF5";

      const res = await callAgentApi({
        body: {
          action: "add_habit",
          payload: {
            title,
            dailyTargetMinutes: minutes,
            color,
          },
        },
      });
      console.log(`✅ 成功新增習慣：「${res.habit?.title}」 (ID: ${res.habit?.id})`);
      return;
    }

    // 3. CHECKIN HABIT
    if (command === "checkin" && subCommand === "habit") {
      const target = targetName || (options.id as string) || (options.title as string);
      if (!target) {
        console.error("❌ 請指定打卡的習慣名稱或 ID：npx tsx scripts/agent-cli.ts checkin habit <名稱>");
        return;
      }

      // 查找目標習慣 ID
      const listRes = await callAgentApi({ endpoint: "?type=habits" });
      const habits = listRes.habits || [];
      const matched = habits.find(
        (h: any) => h.id === target || h.title.toLowerCase().includes(target.toLowerCase())
      );

      if (!matched) {
        console.error(`❌ 找不到包含「${target}」的習慣`);
        return;
      }

      const minutes = options.minutes ? parseInt(options.minutes as string, 10) : undefined;
      const res = await callAgentApi({
        body: {
          action: "checkin_habit",
          payload: {
            id: matched.id,
            minutes,
            note: (options.note as string) || "Agent 打卡",
          },
        },
      });
      console.log(`🎉 成功打卡：「${res.habit?.title}」！連續天數：${res.habit?.streak} 天`);
      return;
    }

    // 4. ADD TASK
    if (command === "add" && subCommand === "task") {
      const title = targetName || (options.title as string);
      if (!title) {
        console.error("❌ 請指定任務標題：npx tsx scripts/agent-cli.ts add task <標題>");
        return;
      }
      const priority = (options.priority as string) || "do-now";
      const dueDate = (options.due as string) || undefined;

      const res = await callAgentApi({
        body: {
          action: "add_task",
          payload: {
            title,
            priority,
            dueDate,
          },
        },
      });
      console.log(`✅ 成功新增任務：「${res.task?.title}」 (優先級: ${res.task?.priority})`);
      return;
    }

    console.log(`未知指令: ${command} ${subCommand || ""}`);
  } catch (err: any) {
    console.error(`❌ 操作失敗: ${err.message}`);
  }
}

main();
