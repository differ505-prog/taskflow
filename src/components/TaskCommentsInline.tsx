"use client";

/**
 * 任務評論 Inline 元件
 * 嵌入 TaskCard 展開區內，內含列表 + 新增 / 刪除輸入框
 */
import React, { useEffect, useState, useRef } from "react";
import { Trash2, MessageSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  subscribeTaskComments,
  addTaskComment,
  deleteTaskComment,
  TaskComment,
} from "@/lib/taskCommentsFS";

interface Props {
  taskId: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "剛剛";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString();
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export default function TaskCommentsInline({ taskId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let unsub: (() => void) | undefined;
    void subscribeTaskComments(user.uid, taskId, (list) => {
      setComments(list);
      setLoading(false);
    }).then((fn) => {
      unsub = fn;
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [user?.uid, taskId]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || !user?.uid || !user?.email || sending) return;
    setSending(true);
    try {
      await addTaskComment({
        uid: user.uid,
        taskId,
        authorEmail: user.email,
        content: trimmed,
      });
      setContent("");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user?.uid) return;
    if (!confirm("刪除這則評論？")) return;
    // 樂觀更新：先從 UI 移除，避免依賴 Realtime 才看到結果
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await deleteTaskComment({ uid: user.uid, taskId, commentId });
    } catch (err) {
      console.error("[TaskComments] 刪除失敗，還原列表", err);
      setComments(previous);
    }
  };

  return (
    <div className="space-y-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle, #e2e8f0)" }}>
      <div className="flex items-center gap-2 pt-1">
        <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
        <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
          評論 {comments.length > 0 && <span className="text-slate-400">({comments.length})</span>}
        </span>
      </div>

      {/* 評論列表 */}
      {loading ? (
        <div className="flex items-center py-2 text-[12px] text-slate-400">
          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> 載入中…
        </div>
      ) : comments.length === 0 ? (
        <p className="text-[12px] text-slate-400">還沒有評論，在下方新增第一則回報</p>
      ) : (
        <ul className="space-y-2.5">
          {comments.map((c) => {
            const isMine = c.authorUid === user?.uid;
            return (
              <li key={c.id} className="group flex items-start gap-2">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[10px] font-semibold text-slate-700">
                  {c.authorEmail.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[12px] font-medium text-slate-800">
                      {isMine ? "你" : maskEmail(c.authorEmail)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {relativeTime(c.createdAt)}
                    </span>
                    {isMine && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="ml-auto rounded p-0.5 text-slate-300 opacity-0 transition-all duration-200 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                        aria-label="刪除評論"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-slate-700">
                    {c.content}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 輸入區 */}
      <div className="space-y-1.5">
        <textarea
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            // Enter 直接送出；Shift+Enter 換行
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="新增回報…（Enter 送出，Shift+Enter 換行）"
          rows={2}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12.5px] text-slate-800 placeholder:text-slate-400 transition-all duration-200 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {content.length} / 500
          </span>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || sending}
            className="rounded-md bg-slate-900 px-3 py-1 text-[12px] font-medium text-white transition-all duration-200 hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {sending ? "送出中…" : "送出"}
          </button>
        </div>
      </div>
    </div>
  );
}
