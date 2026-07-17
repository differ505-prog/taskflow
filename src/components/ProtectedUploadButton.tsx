"use client";

import { useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Attachment } from "@/lib/types";
import { Upload, Lock, AlertCircle, CheckCircle2, X, Image, FileText, Loader2 } from "lucide-react";
import { uploadFile, formatFileSize, getFileIcon, UploadProgress } from "@/lib/storageUpload";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  attachment?: Attachment;
  error?: string;
}

interface ProtectedUploadButtonProps {
  onFilesUploaded: (attachments: Attachment[]) => void;
  existingAttachments?: Attachment[];
  onRemoveAttachment?: (attachment: Attachment) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  maxSizeMB?: number;
}

export function ProtectedUploadButton({
  onFilesUploaded,
  existingAttachments = [],
  onRemoveAttachment,
  accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip",
  multiple = true,
  className = "",
  buttonText = "添加附件",
  buttonIcon,
  maxSizeMB,
}: ProtectedUploadButtonProps) {
  const { user, isAdmin, isBeta, maxFileSizeMB } = useAuth();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Free 用戶：完全不顯示上傳按鈕
  const hasUploadAccess = isAdmin || isBeta;
  const effectiveMaxSize = isAdmin ? Infinity : (maxSizeMB ?? maxFileSizeMB ?? 5) * 1024 * 1024;

  if (!hasUploadAccess) {
    return (
      <div className={`flex items-center gap-2 text-[12px] ${className}`} style={{ color: "var(--text-tertiary)" }}>
        <Lock className="w-3.5 h-3.5" />
        <span>上傳功能僅對早期測試者開放</span>
      </div>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.uid) {
      setError("請先登入後再上傳附件");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // 先讀取檔案、清空 input value，避免「同一檔案選第二次」不觸 onChange 的瀏覽器預設行為
    const files = Array.from(e.target.files || []);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (files.length === 0) return;

    setError(null);

    // 檢查檔案大小
    for (const file of files) {
      if (!isAdmin && file.size > effectiveMaxSize) {
        setError(`「${file.name}」超過大小限制（最大 ${maxSizeMB ?? 5}MB）`);
        return;
      }
    }

    // 初始化上傳項目
    const newItems: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: "pending",
    }));

    setUploads((prev) => [...prev, ...newItems]);
    setIsUploading(true);

    // 開始上傳
    const completedAttachments: Attachment[] = [];

    for (const item of newItems) {
      // 更新狀態為上傳中
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: "uploading" } : u))
      );

      const result = await uploadFile(item.file, user.uid, (progress: UploadProgress) => {
        setUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, progress: progress.progress } : u))
        );
      });

      if (result.success && result.attachment) {
        completedAttachments.push(result.attachment);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, status: "completed", attachment: result.attachment }
              : u
          )
        );
      } else {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, status: "error", error: result.error }
              : u
          )
        );
      }
    }

    setIsUploading(false);

    if (completedAttachments.length > 0) {
      onFilesUploaded(completedAttachments);
    }

    // 清理已完成的上傳（延遲一下讓用戶看到結果）
    setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status === "uploading" || u.status === "pending"));
    }, 2000);

    // 重置 input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const allAttachments = [
    ...existingAttachments,
    ...uploads
      .filter((u) => u.status === "completed" && u.attachment)
      .map((u) => u.attachment!),
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Hidden File Input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />

      {/* Upload Button */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className={`inline-flex items-center gap-2 rounded-xl text-[14px] font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${buttonIcon ? "p-2" : "px-4 py-2"}`}
        style={{
          background: isAdmin ? "var(--brand)" : "rgba(139,92,246,0.12)",
          color: isAdmin ? "white" : "#8B5CF6",
        }}
      >
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : buttonIcon ? (
          buttonIcon
        ) : (
          <>
            <Upload className="w-4 h-4" />
            {buttonText}
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
          style={{ background: "rgba(255,59,48,0.08)", color: "var(--status-danger)" }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Upload Progress */}
      {uploads.filter((u) => u.status === "uploading" || u.status === "pending").length > 0 && (
        <div className="space-y-2">
          {uploads
            .filter((u) => u.status === "uploading" || u.status === "pending")
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 rounded-xl"
                style={{ background: "var(--surface-muted)" }}
              >
                {item.file.type.startsWith("image/") ? (
                  <Image className="w-5 h-5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
                ) : (
                  <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] truncate" style={{ color: "var(--text-primary)" }}>
                    {item.file.name}
                  </p>
                  <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.progress}%`,
                        background: item.status === "error" ? "var(--status-danger)" : "var(--brand)",
                      }}
                    />
                  </div>
                </div>
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {item.progress}%
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Completed Attachments */}
      {allAttachments.length > 0 && (
        <div className="space-y-2">
          {allAttachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              onRemove={
                onRemoveAttachment
                  ? () => onRemoveAttachment(attachment)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 單個附件展示組件
 */
interface AttachmentItemProps {
  attachment: Attachment;
  onRemove?: () => void;
  compact?: boolean;
}

export function AttachmentItem({ attachment, onRemove, compact = false }: AttachmentItemProps) {
  const isImage = attachment.type === "image";

  if (compact) {
    // 緊湊模式：用於 TaskCard 預覽
    if (isImage) {
      return (
        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      );
    }
    return (
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--surface-muted)" }}
      >
        <span className="text-xl">{getFileIcon(attachment.mimeType)}</span>
      </div>
    );
  }

  // 完整模式：用於 TaskForm
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition-colors group"
      style={{ background: "var(--surface-muted)" }}
    >
      {/* 縮略圖或圖標 */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
        style={{ background: "var(--surface-elevated)" }}>
        {isImage ? (
          <img
            src={attachment.url}
            alt={attachment.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect fill='%23e5e7eb' width='24' height='24'/%3E%3Ctext x='12' y='16' text-anchor='middle' font-size='8' fill='%239ca3af'%3E?%3C/text%3E%3C/svg%3E";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl">{getFileIcon(attachment.mimeType)}</span>
          </div>
        )}
      </div>

      {/* 文件資訊 */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {attachment.name}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {formatFileSize(attachment.size)}
        </p>
      </div>

      {/* 操作按鈕 */}
      <div className="flex items-center gap-1">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/5"
          style={{ color: "var(--text-tertiary)" }}
          title="預覽"
        >
          {isImage ? (
            <Image className="w-4 h-4" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
        </a>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-2 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-50"
            style={{ color: "var(--status-danger)" }}
            title="移除"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 顯示上傳權限狀態的徽章組件
 */
export function UploadPermissionBadge() {
  const { user, isAdmin, isBeta } = useAuth();

  if (!user) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
        style={{ background: "rgba(107,114,128,0.1)", color: "var(--text-tertiary)" }}>
        <Lock className="w-3 h-3" />
        請先登入
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
        style={{ background: "rgba(59,130,246,0.12)", color: "#3B82F6" }}>
        <CheckCircle2 className="w-3 h-3" />
        無限上傳
      </div>
    );
  }

  if (isBeta) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
        style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6" }}>
        <Upload className="w-3 h-3" />
        5MB 限制
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
      style={{ background: "rgba(107,114,128,0.1)", color: "var(--text-tertiary)" }}>
      <Lock className="w-3 h-3" />
      上傳未開放
    </div>
  );
}
