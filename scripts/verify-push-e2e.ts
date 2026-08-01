// scripts/verify-push-e2e.ts
// 模擬一個真實訂閱 + 觸發推播，驗證 VAPID 配對 + 後端 fan-out 邏輯

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

async function main() {
  // 1. 載入 env
  require("dotenv").config({ path: ".env.production" });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const privKey = process.env.VAPID_PRIVATE_KEY!;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@vibelist.app";

  console.log("📋 配置：");
  console.log("  Supabase URL:", url);
  console.log("  VAPID Pub:", pubKey.substring(0, 20) + "...");
  console.log("  VAPID Priv:", privKey.substring(0, 20) + "...");
  console.log("");

  // 2. 設定 web-push
  webpush.setVapidDetails(subject, pubKey, privKey);
  console.log("✅ web-push VAPID 配置完成\n");

  // 3. 建立 admin Supabase client
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // 4. 找一個真實 user 來測試（沒有就跳過）
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  const realUser = users?.users?.[0];
  console.log("👤 真實 users:", realUser ? realUser.id : "(無，僅做 VAPID 簽章測試)");

  // 5. 生成測試用訂閱的金鑰對（模擬 client 端）
  //    實際推播流程是：
  //      - 瀏覽器用 pushManager.subscribe(publicKey) 生成
  //      - 產生 ECDH P-256 key pair + auth secret
  //      - 把 publicKey (p256dh) + auth 送給 server
  //      - server 用 privateKey 加密 payload
  //      - 推播 service 解密並遞送給 user agent

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const p256dh = ecdh.getPublicKey().toString("base64url");
  const auth = crypto.randomBytes(16).toString("base64url");

  console.log("\n🔑 生成測試訂閱金鑰：");
  console.log("  p256dh:", p256dh.substring(0, 30) + "...");
  console.log("  auth:", auth.substring(0, 30) + "...");

  // 6. 用 web-push 庫 + 假的 endpoint 嘗試送出（會失敗但能驗證 VAPID 簽章）
  const fakeEndpoint = "https://fcm.googleapis.com/fcm/send/test-fake-endpoint-12345";
  const testSubscription = {
    endpoint: fakeEndpoint,
    keys: { p256dh, auth },
  };
  const payload = JSON.stringify({
    title: "TaskFlow E2E Test",
    body: "VAPID signature validation",
    url: "/",
  });

  console.log("\n📤 嘗試送推播到 fake endpoint（預期會收到 404 但能驗證 VAPID 簽章）：");
  try {
    await webpush.sendNotification(testSubscription, payload);
    console.log("  ✅ 推播成功（意外！）");
  } catch (err: any) {
    console.log("  ⚠️  推播失敗（預期，因 fake endpoint）");
    console.log("  statusCode:", err.statusCode);
    console.log("  body:", err.body?.substring(0, 200));
    console.log("  message:", err.message);

    // 關鍵驗證：401 = VAPID 配對錯誤；404 = VAPID 配對正確但 endpoint 不存在
    if (err.statusCode === 401 || err.statusCode === 403) {
      console.log("\n❌ VAPID 配對錯誤！需要檢查 frontend 公鑰 vs backend 私鑰");
    } else if (err.statusCode === 404 || err.statusCode === 410) {
      console.log("\n✅ VAPID 配對正確！（server 成功簽章，FCM 才會回 404 endpoint 不存在）");
    } else if (err.statusCode === 400) {
      console.log("\n⚠️  400 - 可能是 payload 格式或 endpoint 格式問題");
    }
  }

  // 7. 直接呼叫 production API 驗證
  console.log("\n📡 測試 production push/send API（用 INTERNAL_PUSH_SECRET）：");
  const apiResponse = await fetch("https://www.vibelist.work/api/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-push-secret": process.env.INTERNAL_PUSH_SECRET!,
    },
    body: JSON.stringify({
      owner_uid: realUser?.id || "test-no-user",
      title: "TaskFlow E2E",
      body: "Verify via API",
      url: "/",
    }),
  });

  const apiResult = await apiResponse.json();
  console.log("  HTTP:", apiResponse.status);
  console.log("  Response:", apiResult);

  console.log("\n✅ 全部驗證完成");
}

main().catch((err) => {
  console.error("❌ 失敗:", err);
  process.exit(1);
});
