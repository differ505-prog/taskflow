import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: "VibeList 隱私權政策 - 我們如何處理您的資料",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--surface-muted)" }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-[28px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            隱私權政策
          </h1>
          <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
            最後更新：2026 年 7 月 18 日
          </p>
        </div>

        <div className="card p-8 space-y-8" style={{ color: "var(--text-secondary)" }}>

          <Section title="1. 我們收集什麼資料？">
            <p>
              VibeList 採用雲端同步架構，註冊後您的任務與清單會同步到後端資料庫，
              以便跨裝置存取與共享協作。以下是我們收集的資料：
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li><strong>帳號資料</strong>：您註冊時提供的 Email（作為登入憑證與顯示用匿名化 ID）。</li>
              <li><strong>任務資料</strong>：任務標題、描述、優先級、截止日期、子任務、標籤等，由您主動輸入。</li>
              <li><strong>清單資料</strong>：您建立的個人清單（命名、顏色、圖示）與共享清單（含成員名單與角色）。</li>
              <li><strong>評論資料</strong>：您在任務下新增的回報留言（包含內容、留言時間、留言者 Email）。</li>
              <li><strong>附件資料</strong>：您上傳的圖片與檔案，儲存於 Supabase Storage（含檔名、大小、上傳時間）。</li>
              <li><strong>習慣追蹤資料</strong>：習慣名稱、打卡記錄、連續天數等。</li>
              <li><strong>專注時間資料</strong>：番茄鐘使用記錄（僅儲存時長和時間戳）。</li>
              <li><strong>本地偏好</strong>：主題（淺色/深色）、隱私同意狀態等，僅存於瀏覽器 localStorage。</li>
              <li><strong>Cookies</strong>：用於記住登入狀態、主題偏好與隱私同意記錄，不包含追蹤碼。</li>
            </ul>
            <p className="mt-3">
              <strong>我們不收集：</strong>您的真實姓名（除非您主動填寫於個人檔案）、精確地理位置、行為追蹤資料，
              或任何未列於上方的可識別個人資訊。
            </p>
          </Section>

          <Section title="2. 資料如何儲存？">
            <p>
              您的資料儲存於以下兩個雲端服務，皆位於通過 SOC 2 / ISO 27001 認證的資料中心：
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li>
                <strong>Supabase</strong>（主資料庫）：帳號驗證（Supabase Auth）、任務資料
                （personal_tasks / shared_tasks）、清單資料（shared_lists / shared_list_members）、
                任務評論（task_comments）、附件檔案（Storage bucket: attachments）。
                請參閱{" "}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }}>
                  Supabase 隱私權政策
                </a>
                。
              </li>
              <li>
                <strong>Firebase（legacy 過渡期）</strong>：為支援舊用戶平滑遷移，部分歷史評論與早期任務
                仍暫存於 Firebase Firestore。新資料一律寫入 Supabase。
                請參閱{" "}
                <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }}>
                  Google Firebase 隱私權政策
                </a>
                。
              </li>
            </ul>
            <p className="mt-3">
              此外，您的部分偏好（主題、隱私同意記錄、未同步的草稿）會保留於瀏覽器
              <code>localStorage</code> 中，用於加速載入與離線使用。
            </p>
            <p className="mt-3">
              若您使用 Vercel 託管本服務，Vercel 會收集標準的存取日誌（IP 位址、請求時間等），
              作為其服務基礎設施的一部分。這些資料由 Vercel 控制，請參閱{" "}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }}>
                Vercel 隱私權政策
              </a>
              。
            </p>
          </Section>

          <Section title="3. 資料分享">
            <p>
              <strong>原則</strong>：我們不會向任何第三方出售、租借您的個人資料，
              也不包含任何廣告追蹤碼、分析服務（如 Google Analytics）或第三方嵌入內容。
            </p>
            <p className="mt-3">
              <strong>唯一例外：您主動建立的共享清單</strong>。
              當您邀請他人加入共享清單時，該清單的任務、標籤、評論與附件，
              會對所有 active 成員（owner / editor / viewer）依角色授權顯示。
              成員的 Email 會以匿名化形式（前兩碼 + ***@domain）顯示於評論旁，
              但原始 Email 仍儲存於資料庫以供 owner 管理。
            </p>
            <p className="mt-3">
              <strong>雲端服務商</strong>：如上述（Supabase、Firebase、Vercel）作為基礎設施處理者，
              依其各自隱私權政策處理資料。
            </p>
          </Section>

          <Section title="4. 推播通知與即時同步">
            <p>
              <strong>瀏覽器推播通知</strong>：若您開啟瀏覽器通知以接收任務到期提醒，
              通知內容僅包含任務標題。通知由您的瀏覽器原生機制處理，我們無法存取您的通知資料。
            </p>
            <p className="mt-3">
              <strong>Realtime 即時同步</strong>：任務狀態、評論、共享清單變更透過 Supabase Realtime
              （PostgreSQL 變更訂閱 + WebSocket）即時推播給所有線上裝置與協作成員。
              此機制使用 Supabase 託管的 WebSocket 通道，不經第三方追蹤服務。
            </p>
          </Section>

          <Section title="5. 資料可攜性">
            <p>
              您隨時可以透過「設定 → 匯出資料」功能下載完整的 JSON 備份檔案。
              我們也支援 CSV 格式匯出，方便您在 Excel 或 Google Sheets 中分析資料。
              您也可以匯入之前匯出的 JSON 檔案來還原資料。
            </p>
            <p className="mt-3">
              共享清單資料的匯出僅限於 owner，匯出範圍包含當下所有成員的任務與評論快照。
            </p>
          </Section>

          <Section title="6. 資料保留與刪除">
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li>
                <strong>主動刪除</strong>：您可透過「設定 → 清除所有資料」一鍵刪除所有本地偏好；
                雲端資料則需透過「設定 → 刪除帳號」流程，我們將於 30 天內從 Supabase 永久刪除。
              </li>
              <li>
                <strong>瀏覽器資料清除</strong>：刪除瀏覽器快取與 localStorage 會清除本地偏好，
                但不會刪除雲端資料。
              </li>
              <li>
                <strong>雲端保留</strong>：雲端資料保留於 Supabase Postgres，直到您主動刪除帳號或要求清除。
              </li>
              <li>
                <strong>附件</strong>：刪除帳號時將同步刪除您上傳至 Storage 的所有附件檔案。
              </li>
              <li>
                <strong>共享清單成員資料</strong>：當您從共享清單被移除時，您過去在該清單建立的
                任務與評論將保留（屬於清單所有者的資產）；如需清除，請聯絡清單 owner。
              </li>
              <li>
                <strong>備份</strong>：Supabase 會保留 7 天內的自動備份，
                超出保留期的資料將自動從備份中淘汰。
              </li>
            </ul>
          </Section>

          <Section title="7. 附件與檔案儲存">
            <p>
              您可上傳附件至任務（如圖片、PDF），檔案儲存於 Supabase Storage 的 <code>attachments</code> bucket。
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li><strong>大小限制</strong>：單檔最大 50 MB。</li>
              <li>
                <strong>存取授權</strong>：附件讀取權限依任務授權 — 個人任務僅 owner 可讀；
                共享任務的成員依角色（owner / editor / viewer）可讀；admin 角色可讀取全部附件。
              </li>
              <li><strong>檔案中繼資料</strong>：檔名、大小、上傳時間、上傳者 UID 會儲存於資料庫。</li>
              <li>
                <strong>不掃描內容</strong>：我們不會自動掃描或分析您上傳的附件內容。
              </li>
            </ul>
          </Section>

          <Section title="8. 評論資料">
            <p>
              任務評論儲存於 <code>task_comments</code> 資料表，並受 PostgreSQL Row Level Security (RLS) 保護。
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li>只有作者本人、任務 owner、共享清單 active 成員、清單 owner，以及 admin 角色可讀取評論。</li>
              <li>只有作者本人可刪除自己的評論。</li>
              <li>UI 顯示時，您的 Email 會以匿名化形式（前兩碼 + ***@domain）顯示。</li>
              <li>原始 Email 保留於資料庫以供管理員審核，不會對其他成員洩漏。</li>
            </ul>
          </Section>

          <Section title="9. 兒童隱私">
            <p>
              VibeList 不會刻意收集 13 歲以下兒童的個人資料。
              如果您認為您的孩子向我們提供了個人資料，請聯絡我們，我們會將其刪除。
            </p>
          </Section>

          <Section title="10. Cookies 與本地偏好">
            <p>
              我們使用的 cookies：
            </p>
            <table className="w-full mt-3 text-[13px] border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left py-2 font-medium" style={{ color: "var(--text-primary)" }}>名稱</th>
                  <th className="text-left py-2 font-medium" style={{ color: "var(--text-primary)" }}>用途</th>
                  <th className="text-left py-2 font-medium" style={{ color: "var(--text-primary)" }}>過期</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2">sb-*-auth-token</td>
                  <td className="py-2">Supabase 登入 session（由 Supabase SDK 管理）</td>
                  <td className="py-2">隨 session 失效</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2">taskflow_theme</td>
                  <td className="py-2">記住您選擇的主題</td>
                  <td className="py-2">1 年</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2">taskflow_gdpr_consent</td>
                  <td className="py-2">記住您的隱私同意狀態</td>
                  <td className="py-2">1 年</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="11. 您的權利">
            <p>根據 GDPR（通用資料保護規範）與各國個資法，您享有以下權利：</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li><strong>知情權</strong>：了解我們收集什麼資料（見 §1）。</li>
              <li><strong>存取權</strong>：隨時匯出您的完整資料（見 §5）。</li>
              <li><strong>更正權</strong>：編輯任務、設定與個人檔案以更正錯誤。</li>
              <li><strong>刪除權</strong>：透過「設定 → 刪除帳號」清除雲端資料；「清除所有資料」清除本地偏好（見 §6）。</li>
              <li><strong>資料可攜權</strong>：下載 JSON/CSV 格式的完整備份（見 §5）。</li>
              <li><strong>反對權</strong>：拒絕非必要的 cookies（瀏覽器設定中可調整）。</li>
              <li><strong>退出共享</strong>：隨時離開共享清單，但您在清單內貢獻的任務與評論將由 owner 決定保留與否。</li>
            </ul>
          </Section>

          <Section title="12. 國際傳輸與資料儲存區域">
            <p>
              您的資料主要儲存於 Supabase 的雲端區域（依您註冊時的 Supabase 專案配置區域）。
              當您存取資料時，您的請求會經由 HTTPS 加密傳輸至最近的 Supabase 邊緣節點。
            </p>
            <p className="mt-3">
              若您從歐盟地區使用本服務，所有資料流皆使用 TLS 1.3 加密，
              並透過 Supabase Realtime WebSocket 進行即時同步。
              WebSocket 連線僅用於推送變更事件，不會傳送您的登入密碼或個人憑證。
            </p>
            <p className="mt-3">
              若您從歐盟地區使用瀏覽器通知，通知由瀏覽器供應商（Google、Apple 等）處理，
              請參閱其各自的隱私權政策。
            </p>
          </Section>

          <Section title="13. 政策變更">
            <p>
              我們可能不時更新本隱私權政策。任何重大變更（如新增資料收集類型、
              變更第三方服務商、新增資料保留範圍）都會在此頁面上公告，並更新「最後更新」日期。
              繼續使用 VibeList 即表示您接受更新後的政策。
            </p>
          </Section>

          <Section title="14. 聯絡我們">
            <p>如對本隱私權政策有任何疑問、要行使您的權利，或檢舉個資外洩，請聯絡我們：</p>
            <p>
              <strong>Email</strong>：<span style={{ color: "var(--brand)" }}>support@taskflow.app</span>
            </p>
            <p>
              我們會於 <strong>30 個工作天</strong> 內回覆您的請求。
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[16px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <div className="text-[14px] leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}