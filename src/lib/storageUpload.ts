/**
 * Firebase Storage 上傳工具
 * 處理檔案和圖片上傳到 Firebase Storage
 */
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { getFirebaseStorage, getFirebaseAuth } from "./firebase";
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
 * 生成 Firebase Storage 路徑
 */
function generateStoragePath(uid: string, file: File): string {
  const timestamp = Date.now();
  const randomId = generateId();
  const extension = getFileExtension(file.name);
  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
  const safeName = `${baseName}_${timestamp}_${randomId}${extension ? "." + extension : ""}`;
  return `attachments/${uid}/${safeName}`;
}

/**
 * 上傳單個檔案到 Firebase Storage
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadFileResult> {
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: "請先登入" };
    }

    // 驗證檔案類型
    if (!isAllowedFileType(file.type)) {
      return { success: false, error: "不支援的檔案類型" };
    }

    const storage = getFirebaseStorage();
    const storagePath = generateStoragePath(user.uid, file);
    const storageRef = ref(storage, storagePath);

    return new Promise((resolve) => {
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        (snapshot) => {
          if (onProgress && snapshot.totalBytes > 0) {
            onProgress({
              progress: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
              bytesUploaded: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
            });
          }
        },
        (error) => {
          resolve({ success: false, error: error.message || "上傳失敗" });
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(task.snapshot.ref);
            const attachment: Attachment = {
              id: generateId(),
              name: file.name,
              url: downloadURL,
              type: getFileType(file.type),
              size: file.size,
              mimeType: file.type,
              uploadedAt: new Date().toISOString(),
              storagePath,
            };
            resolve({ success: true, attachment });
          } catch (downloadError: any) {
            resolve({ success: false, error: "獲取下載連結失敗" });
          }
        }
      );
    });
  } catch (error: any) {
    return { success: false, error: error.message || "上傳失敗" };
  }
}

/**
 * 上傳多個檔案
 */
export async function uploadFiles(
  files: File[],
  onProgress?: (fileIndex: number, progress: UploadProgress) => void,
  onFileComplete?: (fileIndex: number, result: UploadFileResult) => void
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  const attachments: Attachment[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await uploadFile(files[i], (progress) => {
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
 * 刪除 Firebase Storage 中的檔案
 */
export async function deleteFile(storagePath: string): Promise<boolean> {
  try {
    const storage = getFirebaseStorage();
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
    return true;
  } catch (error: any) {
    // 檔案可能已被刪除或不存在
    if (error.code === "storage/object-not-found") {
      return true;
    }
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
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "📽️";
  if (mimeType.includes("text")) return "📃";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "📦";
  return "📎";
}
