"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/AppContext";
import { useAuth } from "@/lib/AuthContext";
import { TaskList, Task, SharedListSnapshot } from "@/lib/types";
import { SharedListData, getSharedLists } from "@/lib/storage";
import { getSharedSnapshot } from "@/lib/firestore";
import { SharedMember, MemberRole } from "@/lib/sharedSync";
import { X, Link2, Copy, Check, Users, Trash2, Loader2, Mail, Shield, ShieldCheck, UserMinus } from "lucide-react";

interface ShareListModalProps {
  isOpen: boolean;
  onClose: () => void;
  listToShare?: TaskList | null;
  listTasks?: Task[];
  incomingShareData?: { sharedListId: string; snapshot: SharedListSnapshot } | null;
}

const ROLE_META: Record<MemberRole, { label: string; icon: React.ReactNode; color: string }> = {
  owner:  { label: "Owner",  icon: <ShieldCheck className="w-3 h-3" />, color: "var(--brand)" },
  editor: { label: "Editor", icon: <Shield className="w-3 h-3" />,       color: "var(--status-success)" },
  viewer: { label: "Viewer", icon: <Shield className="w-3 h-3" />,       color: "var(--text-tertiary)" },
};

function ShareLinkButton({ shareUrl, listName, isLoading }: { shareUrl: string; listName: string; isLoading?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
    <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
      <Link2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--brand)" }} />
      <span className="flex-1 text-[12px] truncate font-mono" style={{ color: "var(--text-secondary)" }}>
        {isLoading ? "建立分享連結中..." : shareUrl}
      </span>
      <button
        onClick={handleCopy}
        disabled={isLoading}
        className="p-1.5 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
        title="複製連結"
      >
        {copied ? <Check className="w-4 h-4" style={{ color: "var(--status-success)" }} /> : <Copy className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />}
      </button>
    </div>
  );
}

function MemberRow({
  member,
  currentUserEmail,
  isOwner,
  onChangeRole,
  onRemove,
}: {
  member: SharedMember;
  currentUserEmail: string | null;
  isOwner: boolean;
  onChangeRole: (role: MemberRole) => void;
  onRemove: () => void;
}) {
  const isSelf = currentUserEmail?.toLowerCase() === member.memberEmail.toLowerCase();
  const meta = ROLE_META[member.role];
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {member.memberEmail}
            {isSelf && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                你
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: "var(--surface-elevated)", color: meta.color, border: `1px solid ${meta.color}` }}
          >
            {meta.icon}{meta.label}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              background: member.status === "active" ? "var(--status-success-tint, #dcfce7)" : "var(--surface-elevated)",
              color: member.status === "active" ? "var(--status-success)" : "var(--text-tertiary)",
            }}
          >
            {member.status === "active" ? "已接受" : member.status === "pending" ? "邀請中" : "已移除"}
          </span>
        </div>
      </div>

      {isOwner && !isSelf && member.role !== "owner" && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={member.role}
            onChange={(e) => onChangeRole(e.target.value as MemberRole)}
            className="text-[11px] px-1.5 py-1 rounded-lg"
            style={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
            style={{ color: "var(--status-danger)" }}
            title="移除成員"
          >
            <UserMinus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function ShareListModal({ isOpen, onClose, listToShare, listTasks, incomingShareData }: ShareListModalProps) {
  const { user } = useAuth();
  const {
    sharedLists,
    shareList,
    unshareList,
    acceptSharedList,
    removeAcceptedSharedList,
    membersBySharedList,
    listSharedMembers,
    inviteToSharedList,
    kickFromSharedList,
    changeSharedMemberRole,
    getMyRole,
  } = useApp();
  const [incomingShare, setIncomingShare] = useState<{ sharedListId: string; snapshot: SharedListSnapshot } | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [hasShared, setHasShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // 邀請成員 UI
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("editor");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const sharedListId = listToShare?.sharedId ?? undefined;
  const myRole = sharedListId ? getMyRole(sharedListId) : null;
  const isOwner = myRole === "owner";
  const canInvite = !!isOwner && !!sharedListId;

  const members: SharedMember[] = useMemo(() => {
    if (!sharedListId) return [];
    return (membersBySharedList[sharedListId] || []).filter((m) => m.status !== "removed");
  }, [sharedListId, membersBySharedList]);

  // 連動 incoming share
  useEffect(() => {
    if (incomingShareData) setIncomingShare(incomingShareData);
  }, [incomingShareData]);

  // 打開 modal 時抓成員名單
  useEffect(() => {
    if (isOpen && sharedListId) {
      void listSharedMembers(sharedListId);
    }
  }, [isOpen, sharedListId, listSharedMembers]);

  // 收到 URL 邀請自動 fetch
  useEffect(() => {
    if (!isOpen) return;
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get("share");
    if (shareParam && !shareParam.includes("=") && !shareParam.includes("ey")) {
      window.history.replaceState({}, "", window.location.pathname);
      void getSharedSnapshot(shareParam).then((snapshot) => {
        if (snapshot) setIncomingShare({ sharedListId: shareParam, snapshot });
      });
    }
  }, [isOpen]);

  // 已分享的 list 直接顯示連結
  useEffect(() => {
    if (listToShare?.sharedId) {
      setShareUrl(`${window.location.origin}?share=${listToShare.sharedId}`);
      setHasShared(true);
    }
  }, [listToShare?.sharedId]);

  const handleShareList = useCallback(async () => {
    if (!listToShare || !user) {
      setShareError("尚未偵測到登入帳號，請重新登入後再試。");
      return;
    }
    setShareError(null);
    setIsSharing(true);
    try {
      const id = await shareList(listToShare.id);
      if (id) {
        setShareUrl(`${window.location.origin}?share=${id}`);
        setHasShared(true);
      } else {
        setShareError("createSharedList 回傳 null — 請打開 DevTools console 看 shareList() 內的錯誤訊息。");
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[ShareListModal] handleShareList threw:", err);
      const detail = err?.message || err?.hint || (typeof err === "string" ? err : "");
      setShareError(
        "建立分享連結失敗：" + (detail || "未知錯誤") +
        "。可能原因：(1) Supabase migration 還沒跑；(2) RLS policy 阻擋寫入；(3) Firebase ID token 注入失敗。"
      );
    } finally {
      setIsSharing(false);
    }
  }, [listToShare, user, shareList]);

  const handleUnshare = useCallback(async () => {
    if (!listToShare?.sharedId) return;
    await unshareList(listToShare.sharedId);
    setShareUrl(null);
    setHasShared(false);
  }, [listToShare, unshareList]);

  const handleAcceptIncoming = useCallback(() => {
    if (!incomingShare?.snapshot) return;
    void acceptSharedList(incomingShare.sharedListId, incomingShare.snapshot);
    setIncomingShare(null);
  }, [incomingShare, acceptSharedList]);

  const handleDeclineIncoming = useCallback(() => setIncomingShare(null), []);

  const handleSendInvite = useCallback(async () => {
    if (!sharedListId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      setInviteError("請輸入完整的 Email");
      return;
    }
    if (user?.email?.toLowerCase() === email) {
      setInviteError("不能邀請自己");
      return;
    }
    setInviteBusy(true);
    setInviteError(null);
    try {
      await inviteToSharedList(sharedListId, email, inviteRole);
      setInviteEmail("");
    } catch (err: any) {
      setInviteError(err?.message || "邀請失敗");
    } finally {
      setInviteBusy(false);
    }
  }, [sharedListId, inviteEmail, inviteRole, inviteToSharedList, user]);

  const handleKick = useCallback(async (email: string) => {
    if (!sharedListId) return;
    toast.success(`已移除成員「${email}」，對方將立即失去存取權限。`);
    try {
      await kickFromSharedList(sharedListId, email);
    } catch (err: any) {
      toast.error(err?.message || "移除失敗");
    }
  }, [sharedListId, kickFromSharedList]);

  const handleChangeRole = useCallback(async (email: string, role: MemberRole) => {
    if (!sharedListId) return;
    try {
      await changeSharedMemberRole(sharedListId, email, role);
    } catch (err: any) {
      toast.error(err?.message || "變更角色失敗");
    }
  }, [sharedListId, changeSharedMemberRole]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.3)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: "var(--brand)" }} />
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {listToShare ? "成員管理" : "收藏的共用清單"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Incoming share ── */}
        {incomingShare && (
          <div
            className="p-4 rounded-xl space-y-3"
            style={{ background: "var(--brand-tint)", border: "1px solid var(--brand)" }}
          >
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5" style={{ color: "var(--brand)" }} />
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
                      {incomingShare.snapshot.tasks.length} 項任務 · 由 {incomingShare.snapshot.ownerName || "someone"} 分享
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDeclineIncoming} className="btn-ghost flex-1 text-[13px]">略過</button>
                  <button onClick={handleAcceptIncoming} className="btn-primary flex-1 text-[13px]">接受並加入</button>
                </div>
              </>
            ) : (
              <p className="text-[13px] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                載入分享內容中...
              </p>
            )}
          </div>
        )}

        {/* ── 單一 list：成員管理 ── */}
        {listToShare && (
          <div className="space-y-5">
            {!hasShared && (
              <div>
                {!user ? (
                  <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    請先登入才能分享清單。
                  </p>
                ) : (
                  <>
                    <p className="text-[13px] mb-3" style={{ color: "var(--text-secondary)" }}>
                      建立「{listToShare.name}」的共享空間，邀請 Gmail 帳號加入協作。
                    </p>
                    <button
                      onClick={handleShareList}
                      disabled={isSharing}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      {isSharing ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> 建立中...</>
                      ) : (
                        <><Users className="w-4 h-4" /> 建立共享清單</>
                      )}
                    </button>
                    {shareError && (
                      <p className="text-[12px] text-center mt-2" style={{ color: "var(--status-danger)" }}>
                        {shareError}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {hasShared && shareUrl && (
              <>
                {/* 分享連結 */}
                <div className="space-y-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                    分享連結
                  </h3>
                  <ShareLinkButton shareUrl={shareUrl} listName={listToShare.name} />
                  <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    收到連結的人必須用 <strong>Google 帳號</strong> 登入並通過 Email 比對才能加入。
                  </p>
                </div>

                {/* 邀請新成員（owner only） */}
                {canInvite ? (
                  <div className="space-y-2">
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                      邀請新成員
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="gmail@example.com"
                        className="flex-1 px-3 py-2 rounded-xl text-[13px]"
                        style={{
                          background: "var(--surface-muted)",
                          border: "1px solid var(--border)",
                          color: "var(--text-primary)",
                        }}
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                        className="px-2 py-2 rounded-xl text-[13px]"
                        style={{
                          background: "var(--surface-muted)",
                          border: "1px solid var(--border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={handleSendInvite}
                        disabled={inviteBusy || !inviteEmail.trim()}
                        className="btn-primary px-3 text-[13px] disabled:opacity-50"
                      >
                        {inviteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "邀請"}
                      </button>
                    </div>
                    {inviteError && (
                      <p className="text-[11px]" style={{ color: "var(--status-danger)" }}>
                        {inviteError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl text-[12px]" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                    你目前是 {myRole === "viewer" ? "Viewer（唯讀）" : "成員"}，只有 Owner 可以邀請或移除成員。
                  </div>
                )}

                {/* 成員名單 */}
                <div className="space-y-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                    成員名單（{members.length}）
                  </h3>
                  <div className="space-y-2">
                    {members.map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        currentUserEmail={user?.email ?? null}
                        isOwner={isOwner}
                        onChangeRole={(role) => handleChangeRole(m.memberEmail, role)}
                        onRemove={() => handleKick(m.memberEmail)}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button onClick={handleUnshare} className="btn-ghost flex-1 text-[13px]" style={{ color: "var(--status-danger)" }}>
                    取消整份分享
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 收藏的共用清單（無特定 listToShare） ── */}
        {!listToShare && (
          <div className="space-y-3">
            {Object.keys(sharedLists).length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Users className="w-10 h-10 mx-auto opacity-30" style={{ color: "var(--text-tertiary)" }} />
                <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
                  還沒有收藏的共用清單
                </p>
              </div>
            ) : (
              Object.values(sharedLists).map((data: SharedListData) => {
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
                        {data.tasks.length} 項任務 · 由 {data.ownerName || "someone"} 分享
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        removeAcceptedSharedList(key);
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                      style={{ color: "var(--text-tertiary)" }}
                      title="離開清單"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="pt-1">
          <button onClick={onClose} className="btn-ghost w-full">關閉</button>
        </div>
      </div>
    </div>
  );
}
