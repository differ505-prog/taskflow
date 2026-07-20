/**
 * shareBackup.ts — Web Share API 整合,用於備份檔案匯出
 *
 * 策略:
 * - 手機 Safari/Chrome + 部分桌機支援 navigator.share({ files }):
 *   → 跳出原生分享面板(存 Files、AirDrop、傳 LINE、Email 自己)
 * - 不支援或用戶取消:降級到 <a download> 傳統下載
 *
 * 設計意圖:
 * - 手機 .json 下載後「找不到檔案」是隱藏的 5+ 鍵摩擦
 * - Web Share API 把這摩擦降到 0:出 app 時已選好目的地
 * - 桌機 navigator.share 也支援,Chrome/Edge/Safari 17+ 都可用
 */

export interface ShareBackupOptions {
  /** 備份 JSON 字串 */
  data: string;
  /** 檔名(例:taskflow-backup-2026-07-21.json) */
  filename: string;
  /** 分享失敗/取消時的 fallback(預設觸發 <a download>) */
  onFallback?: () => void;
  /** 成功分享後的回呼 */
  onShared?: () => void;
  /** 用戶取消分享(不是失敗)時的回呼 */
  onCancelled?: () => void;
}

export type ShareResult = "shared" | "cancelled" | "fallback";

/**
 * 偵測瀏覽器是否支援分享檔案
 * - navigator.canShare 必須存在
 * - navigator.canShare({ files }) 必須回 true(代表瀏覽器支援檔案分享)
 */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const testFile = new File(["test"], "test.txt", { type: "text/plain" });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * 嘗試用 Web Share API 分享備份檔;若不支援或失敗,降級到 <a download>
 *
 * @returns "shared" | "cancelled" | "fallback"
 */
export async function shareOrDownloadBackup({
  data,
  filename,
  onFallback,
  onShared,
  onCancelled,
}: ShareBackupOptions): Promise<ShareResult> {
  // 不支援 → 立刻降級
  if (!canShareFiles()) {
    onFallback?.();
    return "fallback";
  }

  try {
    const file = new File([data], filename, { type: "application/json" });
    await navigator.share({
      files: [file],
      title: "TaskFlow 備份",
      text: `${filename} (${new Date(data ? JSON.parse(data).exportedAt : Date.now()).toLocaleDateString("zh-TW")} 匯出)`,
    });
    onShared?.();
    return "shared";
  } catch (err) {
    // AbortError = 用戶取消分享面板(不是失敗,不要顯示錯誤)
    if (err instanceof Error && err.name === "AbortError") {
      onCancelled?.();
      return "cancelled";
    }
    // 其他錯誤(權限、檔案太大等)→ 降級到下載
    console.warn("[shareBackup] Web Share 失敗,降級到下載:", err);
    onFallback?.();
    return "fallback";
  }
}

/**
 * 純降級方案:用 <a download> 觸發下載(原 downloadJSON 邏輯)
 */
export function fallbackDownload(data: string, filename: string): void {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
