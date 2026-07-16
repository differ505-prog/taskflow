#!/usr/bin/env bash
# scripts/setup-cors.sh
#
# 設定 Firebase Storage bucket 的 CORS 白名單
#
# 為什麼需要這個腳本：瀏覽器直接 POST 到 firebasestorage.googleapis.com 時，
# 瀏覽器會發 OPTIONS preflight；如果 bucket 沒把前端 origin 加進 CORS 白名單，
# preflight 不會回 200，整個上傳就會 ERR_FAILED（CORS 錯誤）。
#
# 用法：
#   1. 在 Google Cloud Console → 右上角終端機 → 啟用 Cloud Shell
#   2. 把這個專案 clone 到 Cloud Shell（或先在本機跑這個腳本也行）
#   3. 編輯下方 ORIGINS 陣列，補上你要允許的 origin
#   4. bash scripts/setup-cors.sh
#
# ⚠️ 此腳本會修改線上 bucket。每次執行都會覆蓋整個 CORS config。

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
BUCKET="taskflow-1fbd3.firebasestorage.app"

# 允許的 origins。新增 vercel preview URL 時，把 URL 字串加進這個陣列
ORIGINS=(
  "https://taskflow-v2-pink.vercel.app"
  "https://taskflow-git-main-differ505-prog.vercel.app"
  # ↓ 新增 preview URL 在這裡：
  # "https://taskflow-<branch>-<team>.vercel.app"
)

# 允許的 HTTP methods
METHODS="GET,POST,PUT,PATCH,DELETE,OPTIONS"

# 允許的 request headers
HEADERS="Content-Type,Authorization,Content-Length,User-Agent,x-goog-resumable,x-goog-upload,x-firebase-storage-version"

# 預檢回應快取（秒）：給瀏覽器多久內不必重新跑 preflight
MAX_AGE_SECONDS=3600

# ─── Build cors.json ──────────────────────────────────────────────────────────
CORS_JSON=$(cat <<JSON
[
  {
    "origin": [$(printf '"%s",' "${ORIGINS[@]}" | sed 's/,$//')],
    "method": [$(printf '"%s",' $(echo "$METHODS" | tr ',' '\n' | grep -v '^$') | sed 's/,$//')],
    "responseHeader": [$(printf '"%s",' $(echo "$HEADERS" | tr ',' '\n' | grep -v '^$') | sed 's/,$//')],
    "maxAgeSeconds": $MAX_AGE_SECONDS
  }
]
JSON
)

echo "📝 以下 CORS config 將被套用到 gs://${BUCKET}:"
echo "$CORS_JSON" | python3 -m json.tool
echo ""

# ─── Confirmation ────────────────────────────────────────────────────────────
read -r -p "⚠️  這會覆蓋 bucket 目前的 CORS 設定，確認執行？(y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "已取消。"
  exit 0
fi

# ─── Apply via gsutil ─────────────────────────────────────────────────────────
# 為什麼用 gsutil 而非 gcloud：cors config 是 GS 屬性，gsutil 比 gcloud storage 早支援且更穩
echo "$CORS_JSON" | gsutil cors set /dev/stdin "gs://${BUCKET}"

echo ""
echo "✅ CORS 已更新。驗證當前設定："
gsutil cors get "gs://${BUCKET}"
