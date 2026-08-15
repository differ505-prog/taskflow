/**
 * AccountSection — SettingsPage 內的帳戶權限區塊
 *
 * 職責: 顯示角色 Badge / 權限說明 / Beta 用戶管理（Admin only）
 * 抽取原因: SettingsPage 資料夾化後，此區塊職責獨立且包含 Beta 用戶管理商業邏輯
 */
"use client";

import { useState } from "react";
import { Crown, Sparkles, Shield, UserPlus, UserMinus, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_CONFIGS, UserRole } from "@/lib/types";
import { isComposingKey } from "@/utils/imeGuard";

export function AccountSection() {
  const { user, role, roleConfig, isAdmin, betaUsers, betaLoading, addBetaUser: cloudAddBeta, removeBetaUser: cloudRemoveBeta } = useAuth();
  const [newBetaEmail, setNewBetaEmail] = useState("");
  const [betaMsg, setBetaMsg] = useState<string | null>(null);
  const [betaBusy, setBetaBusy] = useState(false);

  const handleAddBetaUser = async () => {
    if (betaBusy) return;
    const email = newBetaEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setBetaMsg("請輸入有效的 Email");
      setTimeout(() => setBetaMsg(null), 3000);
      return;
    }
    if (betaUsers.map((e) => e.toLowerCase()).includes(email)) {
      setBetaMsg("此用戶已在列表中");
      setTimeout(() => setBetaMsg(null), 3000);
      return;
    }
    try {
      setBetaBusy(true);
      await cloudAddBeta(email);
      setNewBetaEmail("");
      setBetaMsg(`已將 ${email} 加入雲端名單，所有裝置即時生效`);
      setTimeout(() => setBetaMsg(null), 3000);
    } catch (err: unknown) {
      setBetaMsg(`加入失敗：${err instanceof Error ? err.message : "未知錯誤"}`);
      setTimeout(() => setBetaMsg(null), 4000);
    } finally {
      setBetaBusy(false);
    }
  };

  const handleRemoveBetaUser = async (email: string) => {
    if (betaBusy) return;
    try {
      setBetaBusy(true);
      await cloudRemoveBeta(email);
      setBetaMsg(`已從所有裝置移除 ${email}`);
      setTimeout(() => setBetaMsg(null), 3000);
    } catch (err: unknown) {
      setBetaMsg(`移除失敗：${err instanceof Error ? err.message : "未知錯誤"}`);
      setTimeout(() => setBetaMsg(null), 4000);
    } finally {
      setBetaBusy(false);
    }
  };

  return (
    <section>
      <h3 className="text-[12px] font-semibold tracking-tight mb-3" style={{ color: "var(--text-tertiary)" }}>
        帳戶權限
      </h3>

      {/* Current Role Badge */}
      <div
        className="p-4 rounded-xl mb-3"
        style={{
          background: roleConfig.badgeBg,
          border: `1px solid ${roleConfig.badgeColor}20`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: roleConfig.badgeColor }}
          >
            {role === "admin" ? (
              <Crown className="w-5 h-5 text-white" />
            ) : role === "beta" ? (
              <Sparkles className="w-5 h-5 text-white" />
            ) : (
              <Shield className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-semibold" style={{ color: roleConfig.badgeColor }}>
                {roleConfig.label}
              </p>
              {role !== "free" && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: roleConfig.badgeColor,
                    color: "white",
                  }}
                >
                  {role === "admin" ? "創辦人" : "VIP"}
                </span>
              )}
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {roleConfig.description}
            </p>
          </div>
        </div>
      </div>

      {/* Permission Details */}
      <div className="card p-4 space-y-3">
        {/* Upload Permission */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>檔案上傳</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              {role === "admin" ? "無限制" : role === "beta" ? "最大 5MB/單檔" : "暫未開放"}
            </p>
          </div>
          {roleConfig.canUpload ? (
            <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--status-success)" }}>
              <CheckCircle2 className="w-4 h-4" /> 已啟用
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              <AlertCircle className="w-4 h-4" /> 已停用
            </span>
          )}
        </div>

        {/* Role Comparison */}
        <div style={{ height: "1px", background: "var(--border)" }} />
        <div className="space-y-2">
          <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>角色說明</p>
          {(["admin", "beta", "free"] as UserRole[]).map((r) => {
            const cfg = ROLE_CONFIGS[r];
            const isCurrent = r === role;
            return (
              <div
                key={r}
                className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                style={{
                  background: isCurrent ? cfg.badgeBg : "transparent",
                }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.badgeColor }}
                >
                  {r === "admin" ? (
                    <Crown className="w-3.5 h-3.5 text-white" />
                  ) : r === "beta" ? (
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Shield className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: isCurrent ? cfg.badgeColor : "var(--text-primary)" }}>
                    {cfg.label}
                    {isCurrent && "（目前）"}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                    {cfg.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Beta User Management (Admin Only) */}
      {isAdmin && (
        <div className="mt-4">
          <div
            className="p-4 rounded-xl"
            style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4" style={{ color: "var(--brand)" }} />
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                早期測試者管理（雲端）
              </p>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-1"
                style={{ background: "rgba(52,199,89,0.12)", color: "var(--status-success)" }}
              >
                所有裝置即時同步
              </span>
            </div>
            <p className="text-[12px] mb-3" style={{ color: "var(--text-tertiary)" }}>
              手動開通早期測試者資格，賦予上傳功能（5MB/單檔限制）。新增後對方下次登入即生效。
            </p>

            {/* Add Beta User */}
            <div className="flex gap-2 mb-3">
              <label htmlFor="beta-email-input" className="sr-only">Beta 用戶 Email</label>
              <input
                id="beta-email-input"
                type="email"
                value={newBetaEmail}
                onChange={(e) => setNewBetaEmail(e.target.value)}
                onKeyDown={(e) => { if (!isComposingKey(e) && e.key === "Enter") void handleAddBetaUser(); }}
                placeholder="輸入用戶 Email"
                className="input flex-1 text-[13px]"
                style={{ padding: "10px 12px" }}
                disabled={betaBusy}
              />
              <Button
                onClick={() => void handleAddBetaUser()}
                className="flex-shrink-0 disabled:opacity-50"
                disabled={betaBusy}
                loading={betaBusy}
              >
                {betaBusy ? "處理中…" : "添加"}
              </Button>
            </div>

            {/* Beta Users List */}
            {betaLoading ? (
              <p className="text-[12px] text-center py-3" style={{ color: "var(--text-tertiary)" }}>
                從雲端載入…
              </p>
            ) : betaUsers.length > 0 ? (
              <div className="space-y-2">
                {betaUsers.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2.5 rounded-lg"
                    style={{ background: "var(--surface-elevated)" }}
                  >
                    <span className="text-[13px] truncate flex-1" style={{ color: "var(--text-primary)" }}>
                      {email}
                    </span>
                    <button
                      onClick={() => void handleRemoveBetaUser(email)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 ml-2 disabled:opacity-50"
                      style={{ color: "var(--status-danger)" }}
                      aria-label={`移除 ${email}`}
                      disabled={betaBusy}
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-center py-3" style={{ color: "var(--text-tertiary)" }}>
                雲端名單為空，新增第一位測試者吧
              </p>
            )}

            {betaMsg && (
              <p
                className="text-[12px] mt-3 px-3 py-2 rounded-lg"
                style={{
                  background: betaMsg.includes("無效") || betaMsg.includes("已在") || betaMsg.includes("失敗")
                    ? "rgba(255,149,0,0.08)"
                    : "rgba(52,199,89,0.08)",
                  color: betaMsg.includes("無效") || betaMsg.includes("已在") || betaMsg.includes("失敗")
                    ? "var(--status-warning)"
                    : "var(--status-success)",
                }}
              >
                {betaMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
