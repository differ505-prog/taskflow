"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { useAuth } from "@/lib/AuthContext";
import { TaskList, Task, SharedListSnapshot } from "@/lib/types";
import {
  getSharedLists,
  removeSharedList,
  SharedListData,
} from "@/lib/storage";
import { getSharedSnapshot } from "@/lib/firestore";
import { X, Link2, Copy, Check, Users, Trash2, Loader2 } from "lucide-react";

interface ShareListModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The list to share (null = just show shared lists management) */
  listToShare?: TaskList | null;
  /** Tasks belonging to listToShare */
  listTasks?: Task[];
  /** Pre-populated incoming share data (passed in from AppLayout) */
  incomingShareData?: { sharedListId: string; snapshot: SharedListSnapshot } | null;
}

function ShareLinkButton({ shareUrl, listName, isLoading }: { shareUrl: string; listName: string; isLoading?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  return (
    <div className="space-y-3">
      <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        複製以下連結，分享「<strong>{listName}</strong>」給任何人。他們可以在 VibeList 中即時同步查看這份清單。
      </p>
      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
        <Link2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--brand)" }} />
        <span className="flex-1 text-[12px] truncate font-mono" style={{ color: "var(--text-secondary)" }}>
          {isLoading ? "建立分享連結中..." : shareUrl}
        </span>
      </div>
      <button
        onClick={handleCopy}
        disabled={isLoading}
        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" /> 已複製！
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" /> 複製連結
          </>
        )}
      </button>
    </div>
  );
}

function SharedListItem({
  data,
  onRemove,
}: {
  data: SharedListData;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
    >
      <span className="text-xl flex-shrink-0">{data.list.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {data.list.name}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {data.tasks.length} 項任務
          {data.ownerName && ` · 由 ${data.ownerName} 分享`}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
        style={{ color: "var(--text-tertiary)" }}
        title="移除收藏"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ShareListModal({ isOpen, onClose, listToShare, listTasks, incomingShareData }: ShareListModalProps) {
  const { user } = useAuth();
  const { sharedLists, shareList, unshareList, acceptSharedList, removeAcceptedSharedList } = useApp();
  const [sharedListsState, setSharedListsState] = useState<Record<string, SharedListData>>({});
  const [incomingShare, setIncomingShare] = useState<{ sharedListId: string; snapshot: SharedListSnapshot } | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [hasShared, setHasShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Sync incoming share data passed from AppLayout (overrides local URL check)
  useEffect(() => {
    if (incomingShareData) {
      setIncomingShare(incomingShareData);
    }
  }, [incomingShareData]);

  // Load shared lists on open
  useEffect(() => {
    if (isOpen) {
      setSharedListsState(sharedLists);
    }
  }, [isOpen, sharedLists]);

  // Check for incoming share link in URL when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get("share");

    if (shareParam && !shareParam.includes("=") && !shareParam.includes("ey")) {
      // This is a new-style share ID (not base64)
      // Clean URL without reload
      window.history.replaceState({}, "", window.location.pathname);

      // Fetch the snapshot from Firestore
      getSharedSnapshot(shareParam).then((snapshot) => {
        if (snapshot) {
          setIncomingShare({ sharedListId: shareParam, snapshot });
        }
      });
    }
  }, [isOpen]);

  // Handle sharing a list
  const handleShareList = useCallback(async () => {
    console.log("[handleShareList] user:", user, "listToShare:", listToShare);
    if (!listToShare || !user) return;
    setShareError(null);
    setIsSharing(true);
    try {
      const sharedListId = await shareList(listToShare.id);
      console.log("[handleShareList] sharedListId returned:", sharedListId);
      if (sharedListId) {
        setShareUrl(`${window.location.origin}?share=${sharedListId}`);
        setHasShared(true);
      } else {
        setShareError("建立分享連結失敗，請確認已登入後再試。");
      }
    } catch (error: any) {
      console.error("Share error:", error);
      setShareError("建立分享連結時發生錯誤：" + (error?.message || "未知錯誤"));
    } finally {
      setIsSharing(false);
    }
  }, [listToShare, user]);

  // Handle unsharing a list
  const handleUnshare = useCallback(async () => {
    if (!listToShare?.sharedId) return;
    await unshareList(listToShare.sharedId);
    setShareUrl(null);
    setHasShared(false);
  }, [listToShare]);

  // Handle accepting incoming shared list
  const handleAcceptIncoming = useCallback(() => {
    if (!incomingShare?.snapshot) return;
    acceptSharedList(incomingShare.sharedListId, incomingShare.snapshot);
    setIncomingShare(null);
  }, [incomingShare]);

  const handleDeclineIncoming = useCallback(() => {
    setIncomingShare(null);
  }, []);

  const handleRemoveShared = useCallback((sharedId: string) => {
    removeAcceptedSharedList(sharedId);
    setSharedListsState(getSharedLists());
  }, []);

  // If we have a list to share, check if it's already shared
  useEffect(() => {
    if (listToShare?.sharedId) {
      setShareUrl(`${window.location.origin}?share=${listToShare.sharedId}`);
      setHasShared(true);
    }
  }, [listToShare?.sharedId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.3)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {listToShare ? "分享清單" : "收藏的共用清單"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Incoming share notification ── */}
        {incomingShare && (
          <div
            className="p-4 rounded-xl space-y-3"
            style={{ background: "var(--brand-tint)", border: "1px solid var(--brand)" }}
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: "var(--brand)" }} />
              <p className="text-[14px] font-semibold" style={{ color: "var(--brand)" }}>
                收到共用清單邀請
              </p>
            </div>
            {incomingShare.snapshot ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{incomingShare.snapshot.list.icon}</span>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {incomingShare.snapshot.list.name}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      {incomingShare.snapshot.tasks.length} 項任務
                      {incomingShare.snapshot.ownerName && ` · 由 ${incomingShare.snapshot.ownerName} 分享`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDeclineIncoming} className="btn-ghost flex-1 text-[13px]">
                    略過
                  </button>
                  <button onClick={handleAcceptIncoming} className="btn-primary flex-1 text-[13px]">
                    接受並收藏
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  載入分享內容中...
                </p>
                <button onClick={handleDeclineIncoming} className="btn-ghost w-full text-[13px]">
                  取消
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Share a specific list ── */}
        {listToShare && !hasShared && (
          <div className="space-y-4">
            {!user ? (
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                請先登入才能分享清單。
              </p>
            ) : (
              <button
                onClick={handleShareList}
                disabled={isSharing}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {isSharing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    建立分享連結...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    建立即時同步分享連結
                  </>
                )}
              </button>
            )}
            {shareError && (
              <p className="text-[12px] text-center" style={{ color: "var(--status-danger)" }}>
                {shareError}
              </p>
            )}
          </div>
        )}

        {/* ── Show share link for already shared lists ── */}
        {listToShare && hasShared && shareUrl && (
          <div className="space-y-4">
            <ShareLinkButton shareUrl={shareUrl} listName={listToShare.name} />
            <div className="flex gap-2">
              <button onClick={handleUnshare} className="btn-ghost flex-1 text-[13px]">
                取消分享
              </button>
            </div>
            <p className="text-[11px] text-center" style={{ color: "var(--text-tertiary)" }}>
              修改清單後，分享連結的內容會自動同步更新。
            </p>
          </div>
        )}

        {/* ── Show all shared lists (when opened without a specific list) ── */}
        {!listToShare && (
          <div className="space-y-3">
            {Object.keys(sharedListsState).length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Users className="w-10 h-10 mx-auto opacity-30" style={{ color: "var(--text-tertiary)" }} />
                <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
                  還沒有收藏的共用清單
                </p>
                <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  在清單上點擊「分享」即可開始
                </p>
              </div>
            ) : (
              <>
                <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  已收藏的共用清單（自動同步更新）
                </p>
                {Object.values(sharedListsState).map((data) => {
                  const key = data.list.sharedId ?? data.list.id;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
                    >
                      <span className="text-xl flex-shrink-0">{data.list.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {data.list.name}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                          {data.tasks.length} 項任務
                          {data.ownerName && ` · 由 ${data.ownerName} 分享`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveShared(key)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                        style={{ color: "var(--text-tertiary)" }}
                        title="移除收藏"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-1">
          <button onClick={onClose} className="btn-ghost w-full">
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
