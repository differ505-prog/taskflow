# TaskFlow

優雅高效的任務管理工具

## 快速開始

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

## 技術棧

- **框架**: Next.js 15 (App Router)
- **語言**: TypeScript (strict)
- **樣式**: Tailwind CSS 3.4
- **動畫**: Framer Motion 12
- **圖示**: Lucide React
- **時間**: date-fns 4
- **持久化**: LocalStorage

## 功能特色

- 任務 CRUD (新增/編輯/刪除/完成)
- 優先級設定 (高/中/低)
- 狀態追蹤 (待辦/進行中/已完成)
- 截止日期管理 (含逾期提醒)
- 標籤系統
- 搜尋過濾
- 網格/列表視圖切換
- 響應式設計 (桌機/平板/手機)
- 資料本地持久化
- **附件上傳**（限管理員 / Beta 用戶，使用 Firebase Storage）

---

## Firebase Storage CORS 設定

瀏覽器直接 POST 到 `firebasestorage.googleapis.com` 時會發 OPTIONS preflight。
如果 bucket 沒把前端 origin 加進 CORS 白名單，所有上傳會 ERR_FAILED。

### 一次性設定

1. 到 Google Cloud Console → 右上角「啟用 Cloud Shell」
2. 把這個 repo 拉到 Cloud Shell（或在本機裝 [gcloud SDK](https://cloud.google.com/sdk/docs/install)）
3. 編輯 `scripts/setup-cors.sh` 的 `ORIGINS` 陣列，列出所有允許的 URL
4. 跑：`bash scripts/setup-cors.sh`
5. 確認輸出看到現有 origin 列表

### 新增 vercel preview URL

每次加新的 preview deployment，把新網址加進 `scripts/setup-cors.sh` 的 `ORIGINS` 並重跑。

例如：

```diff
 ORIGINS=(
   "https://taskflow-v2-pink.vercel.app"
   "https://taskflow-git-main-differ505-prog.vercel.app"
+  "https://taskflow-git-feature-xxx-differ505-prog.vercel.app"
 )
```

### 驗證是否設定成功

DevTools Console 上傳附件時不該出現：

```
Access to XMLHttpRequest ... blocked by CORS policy
```

若仍出現 → 在 Cloud Shell 跑 `gsutil cors get gs://taskflow-1fbd3.firebasestorage.app` 看輸出，必要時附給工程師除錯。
