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
 * 生成 Supabase Storage 路徑
 */
function generateStoragePath(uid: string, file: File): string {
  const timestamp = Date.now();
  const randomId = generateId();
  const extension = getFileExtension(file.name);
  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9]/g, "_");
  const safeName = `${baseName}_${timestamp}_${randomId}${
    extension ? "." + extension : ""
  }`;
  return `${uid}/${safeName}`;
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

    if (!isAllowedFileType(file.type)) {
      return { success: false, error: "不支援的檔案類型" };
    }

    const supabase = getSupabaseClient();
    const storagePath = generateStoragePath(userId, file);

    // Supabase JS SDK 沒有 resumable upload 的原生進度事件
    // 用 XHR 才能拿到 progress event（fetch API 沒有上傳進度）
    const publicUrl = await uploadWithProgress(
      supabase,
      ATTACHMENTS_BUCKET,
      storagePath,
      file,
      onProgress
    );

    const attachment: Attachment = {
      id: generateId(),
      name: file.name,
      url: publicUrl,
      type: getFileType(file.type),
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      storagePath: `${ATTACHMENTS_BUCKET}/${storagePath}`,
    };
    return { success: true, attachment };
  } catch (error: any) {
    return { success: false, error: error?.message || "上傳失敗" };
  }
}

/**
 * 用 XHR 上傳以取得進度事件，並透過 Supabase REST endpoint 完成上傳。
 *
 * 為何不直接用 supabase.storage.from(bucket).upload()：
 *   - 該方法的 onUploadProgress 在瀏覽器端不支援進度回報
 *   - XHR 上傳到 Supabase Storage REST endpoint 才能拿到真實進度
 */
function uploadWithProgress(
  supabase: ReturnType<typeof getSupabaseClient>,
  bucket: string,
  path: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const apiKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !apiKey) {
        throw new Error("Supabase 環境變數未設定");
      }

      const xhr = new XMLHttpRequest();
      const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

      xhr.open("POST", url, true);
      xhr.setRequestHeader("apikey", apiKey);
      xhr.setRequestHeader(
        "Authorization",
        `Bearer ${session?.access_token ?? apiKey}`
      );
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
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
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
          resolve(publicUrl);
        } else {
          let msg = `上傳失敗 (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText);
            if (body?.message) msg = body.message;
          } catch {
            // response 不是 JSON
          }
          reject(new Error(msg));
        }
      };

      xhr.onerror = () => reject(new Error("網路錯誤，上傳失敗"));
      xhr.ontimeout = () => reject(new Error("上傳逾時"));

      xhr.send(file);
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
