"use client";

/**
 * 任務評論 Drawer
 * - 從右側滑入
 * - 顯示當前任務的評論列表
 * - 輸入框 + 新增按鈕
 * - 自己的評論可刪除
 */
import React, { useEffect, useState, useRef } from "react";
import { X, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import {
  subscribeTaskComments,
  addTaskComment,
  deleteTaskComment,
  TaskComment,
} from "@/lib/taskCommentsFS";
import { isComposingKey } from "@/utils/imeGuard";

interface Props {
  taskId: string;
  taskTitle: string;
  open: boolean;
  onClose: () => void;
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

export default function TaskCommentsDrawer({ taskId, taskTitle, open, onClose }: Props) {
  const { user } = useAuth();
  const keyboard = useKeyboardOffset();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ESC 關閉 drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !user?.uid) return;
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
  }, [open, user?.uid, taskId]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 250);
    } else {
      setContent("");
    }
  }, [open]);

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
    await deleteTaskComment({ uid: user.uid, taskId, commentId });
  };

  return (
    <>
      {/* 遮罩 */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ height: keyboard > 0 ? `calc(100vh - ${keyboard}px)` : "100vh" }}
        aria-label="任務評論"
        aria-hidden={!open}
      >
        {/* Header */}
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <MessageSquare className="h-4 w-4 text-slate-500" />
              任務評論
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500" title={taskTitle}>
              {taskTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 active:scale-95"
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* 評論列表 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              載入中…
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <MessageSquare className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">還沒有評論</p>
              <p className="mt-1 text-xs text-slate-400">在下方輸入第一則回報</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => {
                const isMine = c.authorUid === user?.uid;
                return (
                  <li key={c.id} className="group">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-semibold text-slate-700">
                        {c.authorEmail.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-medium text-slate-800">
                            {isMine ? "你" : maskEmail(c.authorEmail)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {relativeTime(c.createdAt)}
                          </span>
                          {isMine && (
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="ml-auto rounded p-1 text-slate-300 opacity-0 transition-all duration-200 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                              aria-label="刪除評論"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                          {c.content}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 輸入區 */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (isComposingKey(e)) return;
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="新增回報… (⌘/Ctrl + Enter 送出)"
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-200 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {content.length} / 500
            </span>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || sending}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {sending ? "送出中…" : "送出"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}