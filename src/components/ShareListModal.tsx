"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { TaskList, Task } from "@/lib/types";
import {
  encodeSharePayload,
  decodeSharePayload,
  getSharedLists,
  saveSharedList,
  removeSharedList,
  SharedListData,
} from "@/lib/storage";
import { X, Link2, Copy, Check, Users, Trash2, ExternalLink } from "lucide-react";

interface ShareListModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The list to share (null = just show shared lists management) */
  listToShare?: TaskList | null;
  /** Tasks belonging to listToShare */
  listTasks?: Task[];
}

function ShareLinkButton({ shareUrl, listName }: { shareUrl: string; listName: string }) {
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
        複製以下連結，分享「<strong>{listName}</strong>」給任何人。他們可以在 VibeList 中瀏覽並共同編輯這份清單。
      </p>
      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
        <Link2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--brand)" }} />
        <span className="flex-1 text-[12px] truncate font-mono" style={{ color: "var(--text-secondary)" }}>
          {shareUrl}
        </span>
      </div>
      <button
        onClick={handleCopy}
        className="w-full btn-primary flex items-center justify-center gap-2"
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

export function ShareListModal({ isOpen, onClose, listToShare, listTasks }: ShareListModalProps) {
  const { lists } = useApp();
  const [sharedLists, setSharedLists] = useState<Record<string, SharedListData>>({});
  const [incomingShare, setIncomingShare] = useState<SharedListData | null>(null);
  const [incomingError, setIncomingError] = useState(false);

  // Load shared lists on open
  useEffect(() => {
    if (isOpen) {
      setSharedLists(getSharedLists());

      // Check for incoming share link in URL
      const params = new URLSearchParams(window.location.search);
      const shareParam = params.get("share");
      if (shareParam) {
        const decoded = decodeSharePayload(shareParam);
        if (decoded) {
          setIncomingShare(decoded);
        } else {
          setIncomingError(true);
        }
        // Clean URL without reload
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const shareUrl = listToShare
    ? `${window.location.origin}${window.location.pathname}?share=${encodeSharePayload(listToShare, listTasks ?? [])}`
    : null;

  const handleAcceptIncoming = () => {
    if (!incomingShare) return;
    // Use sharedId from list as key
    const key = incomingShare.list.sharedId ?? incomingShare.list.id;
    saveSharedList(key, incomingShare);
    setSharedLists(getSharedLists());
    setIncomingShare(null);
  };

  const handleDeclineIncoming = () => {
    setIncomingShare(null);
  };

  const handleRemoveShared = (sharedId: string) => {
    removeSharedList(sharedId);
    setSharedLists(getSharedLists());
  };

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
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              <strong>{incomingShare.list.name}</strong>（{incomingShare.tasks.length} 項任務）
              {incomingShare.ownerName && ` · 由 ${incomingShare.ownerName} 分享`}
            </p>
            <div className="flex gap-2">
              <button onClick={handleDeclineIncoming} className="btn-ghost flex-1 text-[13px]">
                略過
              </button>
              <button onClick={handleAcceptIncoming} className="btn-primary flex-1 text-[13px]">
                接受並收藏
              </button>
            </div>
          </div>
        )}

        {incomingError && (
          <div className="p-3 rounded-xl text-[13px]" style={{ background: "rgba(255,59,48,0.08)", color: "var(--status-danger)" }}>
            分享連結無效或已過期。
          </div>
        )}

        {/* ── Share a specific list ── */}
        {listToShare && (
          <ShareLinkButton shareUrl={shareUrl!} listName={listToShare.name} />
        )}

        {/* ── Show all shared lists (when opened without a specific list) ── */}
        {!listToShare && (
          <div className="space-y-3">
            {Object.keys(sharedLists).length === 0 ? (
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
                  從連結收藏的共用清單（唯讀）
                </p>
                {Object.values(sharedLists).map((data) => (
                  <SharedListItem
                    key={data.list.sharedId ?? data.list.id}
                    data={data}
                    onRemove={() => handleRemoveShared(data.list.sharedId ?? data.list.id)}
                  />
                ))}
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
