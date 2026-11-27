/**
 * Supabase Storage 上傳工具
 *
 * 處理檔案和圖片上傳到 Supabase Storage（attachments bucket）。
 * 對外 export 介面與原本 Firebase Storage 版本完全相同，
 * 呼叫端（ProtectedUploadButton / AppContext）無需修改。
 */
import { getSupabaseClient, ATTACHMENTS_BUCKET } from "./supabase";
import { Attachment } from "./types";
import { generateId } from "./storage";

// 支援的圖片類型
const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

// 支援的檔案類型
const ALLOWED_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
];

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
};

/** 推斷並正規化檔案 MIME（處理部分手機瀏覽器 file.type 為空或 image/jpg） */
export function resolveFileMimeType(file: Pick<File, "name" | "type">): string {
  const raw = (file.type || "").trim().toLowerCase();
  if (raw === "image/jpg") return "image/jpeg";
  if (raw) return raw;
  const ext = getFileExtension(file.name);
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

export interface UploadProgress {
  progress: number; // 0-100
  bytesUploaded: number;
  totalBytes: number;
}

export interface UploadFileResult {
  success: boolean;
  attachment?: Attachment;
  error?: string;
}

/**
 * 判斷檔案類型
 */
export function getFileType(mimeType: string): "image" | "file" {
  return IMAGE_MIME_TYPES.includes(mimeType) ? "image" : "file";
}

/**
 * 驗證檔案類型
 */
export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * 獲取檔案副檔名
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

/**
 * 上傳單個檔案到 Supabase Storage
 *
 * `userId` 從呼叫端的 Auth state 傳入（React Context），
 * 作為 Supabase bucket 內的路徑前綴，結構對齊原本 Firebase 版本。
 */
export async function uploadFile(
  file: File,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadFileResult> {
  try {
    if (!userId) {
      return { success: false, error: "請先登入" };
    }

    const mimeType = resolveFileMimeType(file);
    if (!isAllowedFileType(mimeType)) {
      return { success: false, error: "不支援的檔案類型" };
    }

    const supabase = getSupabaseClient();

    // Supabase JS SDK 沒有 resumable upload 的原生進度事件
    // 用 XHR 才能拿到 progress event（fetch API 沒有上傳進度）
    const { publicUrl, path: serverPath } = await uploadWithProgress(
      supabase,
      file,
      mimeType,
      onProgress
    );

    const attachment: Attachment = {
      id: generateId(),
      name: file.name,
      url: publicUrl,
      type: getFileType(mimeType),
      size: file.size,
      mimeType,
      uploadedAt: new Date().toISOString(),
      storagePath: `${ATTACHMENTS_BUCKET}/${serverPath}`,
    };
    return { success: true, attachment };
  } catch (error: any) {
    return { success: false, error: error?.message || "上傳失敗" };
  }
}

/**
 * 用 XHR 上傳以取得進度事件，並透過 Supabase signed upload URL 完成上傳。
 *
 * 流程：
 * 1. fetch POST /api/storage/sign-upload，拿 { uploadUrl, token, path, publicUrl }
 * 2. XHR PUT（FormData，對齊 @supabase/storage-js uploadToSignedUrl 規格）到 uploadUrl
 * 3. 成功後回傳 { publicUrl, path }
 */
function uploadWithProgress(
  supabase: ReturnType<typeof getSupabaseClient>,
  file: File,
  mimeType: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ publicUrl: string; path: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      if (!supabase) {
        throw new Error("Supabase 環境變數未設定");
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Step 1: 向 server 拿 signed upload URL
      let signData: { uploadUrl: string; token: string; path: string; publicUrl: string } | null = null;
      try {
        const signRes = await fetch("/api/storage/sign-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            filename: file.name,
            mimeType,
            size: file.size,
          }),
        });

        if (!signRes.ok) {
          const errBody = await signRes.json().catch(() => ({}));
          throw new Error(errBody.error ?? `Server rejected upload (${signRes.status})`);
        }

        signData = await signRes.json();
      } catch (signErr: any) {
        if (signErr instanceof Error) reject(signErr);
        else reject(new Error(String(signErr)));
        return;
      }

      // Step 2: 用 XHR PUT + FormData 向 signed URL 上傳（與 @supabase/storage-js uploadToSignedUrl 一致）
      const xhr = new XMLHttpRequest();
      const uploadUrl = signData!.uploadUrl;

      xhr.open("PUT", uploadUrl, true);
      xhr.timeout = 60_000;
      xhr.setRequestHeader("x-upsert", "true");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            progress: Math.round((e.loaded / e.total) * 100),
            bytesUploaded: e.loaded,
            totalBytes: e.total,
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ publicUrl: signData!.publicUrl, path: signData!.path });
        } else {
          let msg = `上傳失敗 (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText);
            if (body?.message) msg = body.message;
            if (body?.error) msg = body.error;
          } catch {
            // response body 不是 JSON,沿用 status code 訊息
          }
          reject(new Error(msg));
        }
      };

      xhr.onerror = () => reject(new Error("網路錯誤，上傳失敗"));
      xhr.ontimeout = () => reject(new Error("上傳逾時"));

      const formData = new FormData();
      formData.append("cacheControl", "3600");
      formData.append("", file);
      xhr.send(formData);
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * 上傳多個檔案
 */
export async function uploadFiles(
  files: File[],
  userId: string,
  onProgress?: (fileIndex: number, progress: UploadProgress) => void,
  onFileComplete?: (fileIndex: number, result: UploadFileResult) => void
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  const attachments: Attachment[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await uploadFile(files[i], userId, (progress) => {
      onProgress?.(i, progress);
    });

    if (result.success && result.attachment) {
      attachments.push(result.attachment);
    } else {
      errors.push(`${files[i].name}: ${result.error}`);
    }

    onFileComplete?.(i, result);
  }

  return { attachments, errors };
}

/**
 * 刪除 Supabase Storage 中的檔案
 */
export async function deleteFile(storagePath: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error("[Storage] Delete error: Supabase client not configured");
      return false;
    }
    // 傳入的 storagePath 可能是 "attachments/uid/file" 或僅 "uid/file"
    const cleanPath = storagePath.startsWith(`${ATTACHMENTS_BUCKET}/`)
      ? storagePath.slice(ATTACHMENTS_BUCKET.length + 1)
      : storagePath;

    const { error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove([cleanPath]);

    if (error) {
      console.error("[Storage] Delete error:", error);
      return false;
    }
    return true;
  } catch (error: any) {
    console.error("[Storage] Delete error:", error);
    return false;
  }
}

/**
 * 格式化檔案大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * 獲取檔案圖標（基於 MIME 類型）
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📊";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
    return "📽️";
  if (mimeType.includes("text")) return "📃";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "📦";
  return "📎";
}
