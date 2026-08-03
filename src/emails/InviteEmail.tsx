/**
 * 邀請加入共用清單 Email
 *
 * Props:
 *   inviterName  — 邀請人名稱
 *   listName     — 清單名稱
 *   listIcon     — 清單 emoji
 *   inviteLink   — 完整邀請 URL
 *   role         — 角色（editor / viewer）
 */

interface InviteEmailProps {
  inviterName: string;
  listName: string;
  listIcon: string;
  inviteLink: string;
  role: string;
}

export function renderInviteEmail(props: InviteEmailProps): { html: string; text: string } {
  const { inviterName, listName, listIcon, inviteLink, role } = props;
  const roleLabel = role === "viewer" ? "檢視者（唯讀）" : "編輯者";

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>邀請加入 ${listName}</title>
</head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#3B82F6 0%,#60A5FA 100%);padding:40px 40px 32px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">${listIcon}</div>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                邀請你加入共用清單
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
                <strong style="color:#1f2937;">${inviterName}</strong> 邀請你加入他的清單：
              </p>

              <div style="background:#f3f4f6;border-radius:12px;padding:20px 24px;margin-bottom:32px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <span style="font-size:32px;">${listIcon}</span>
                  <div>
                    <div style="font-size:18px;font-weight:600;color:#1f2937;">${listName}</div>
                    <div style="font-size:13px;color:#6b7280;margin-top:4px;">
                      將作為 <strong>${roleLabel}</strong> 加入
                    </div>
                  </div>
                </div>
              </div>

              <p style="margin:0 0 32px;font-size:14px;color:#6b7280;line-height:1.6;">
                點擊下方按鈕接受邀請，你將自動加入這份共用清單。<br>
                連結有效期為 7 天。
              </p>

              <div style="text-align:center;margin-bottom:32px;">
                <a href="${inviteLink}"
                   style="display:inline-block;background:#3B82F6;color:#ffffff;font-size:16px;font-weight:600;padding:16px 40px;border-radius:12px;text-decoration:none;box-shadow:0 2px 8px rgba(59,130,246,0.35);">
                  接受邀請
                </a>
              </div>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                如果按鈕無法點擊，請複製以下連結到瀏覽器開啟：<br>
                <a href="${inviteLink}" style="color:#3B82F6;word-break:break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                這是系統自動發送的邀請通知，請勿直接回覆。<br>
                若你沒有收到過此邀請，可以忽略這封郵件。
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `${inviterName} 邀請你加入他的清單「${listName}」

點擊以下連結接受邀請（有效期 7 天）：
${inviteLink}

你將作為 ${roleLabel} 加入這份清單。

若無法點擊，請複製連結到瀏覽器開啟。

---
這是系統自動發送的邀請通知，請勿直接回覆。
`;

  return { html, text };
}
