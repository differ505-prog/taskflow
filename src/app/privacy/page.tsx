import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: "TaskFlow 隱私權政策 - 我們如何處理您的資料",
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
            最後更新：2026 年 7 月 7 日
          </p>
        </div>

        <div className="card p-8 space-y-8" style={{ color: "var(--text-secondary)" }}>

          <Section title="1. 我們收集什麼資料？">
            <p>TaskFlow 的設計理念是「隱私優先」。以下是可能收集的資料：</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li><strong>任務資料</strong>：任務標題、描述、優先級、截止日期、子任務、標籤等，由您主動輸入。</li>
              <li><strong>習慣追蹤資料</strong>：習慣名稱、打卡記錄、連續天數等。</li>
              <li><strong>專注時間資料</strong>：番茄鐘使用記錄（僅儲存時長和時間戳）。</li>
              <li><strong>本地儲存資料</strong>：所有上述資料預設儲存在您瀏覽器的 localStorage 中。</li>
              <li><strong>Cookies</strong>：用於記住您的主題偏好（淺色/深色）和隱私同意狀態，不包含追蹤碼。</li>
            </ul>
            <p className="mt-3">
              <strong>我們不收集：</strong>您的姓名、Email、位置、精確行為追蹤或任何可識別個人身分的資訊。
            </p>
          </Section>

          <Section title="2. 資料如何儲存？">
            <p>
              您的所有資料預設儲存在<b>您自己的設備上</b>（瀏覽器 localStorage）。
              這意味著：資料不會上傳到我們的伺服器，我們也無法存取您的任務內容。
            </p>
            <p className="mt-3">
              若您使用 Vercel 部署，Vercel 可能會收集標準的存取日誌（IP 位址、請求時間等），
              作為其服務基礎設施的一部分。這些資料由 Vercel 控制，請參閱{" "}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }}>
                Vercel 隱私權政策
              </a>{" "}
              。
            </p>
          </Section>

          <Section title="3. 資料分享">
            <p>
              我們不會向任何第三方出售、租借或分享您的個人資料。
              我們不包含任何廣告追蹤碼、分析服務（如 Google Analytics）或第三方嵌入內容。
            </p>
          </Section>

          <Section title="4. 推播通知">
            <p>
              若您開啟瀏覽器通知以接收任務到期提醒，通知內容僅包含任務標題。
              通知由您的瀏覽器原生機制處理，我們無法存取您的通知資料。
            </p>
          </Section>

          <Section title="5. 資料可攜性">
            <p>
              您隨時可以透過「設定 → 匯出資料」功能下載完整的 JSON 備份檔案。
              我們也支援 CSV 格式匯出，方便您在 Excel 或 Google Sheets 中分析資料。
              您也可以匯入之前匯出的 JSON 檔案來還原資料。
            </p>
          </Section>

          <Section title="6. 資料保留與刪除">
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li>您的資料保留在您瀏覽器中，直到您主動刪除。</li>
              <li>您可以隨時透過「設定 → 清除所有資料」刪除所有本地資料。</li>
              <li>刪除瀏覽器資料（清除快取）也會刪除 TaskFlow 儲存的所有資料。</li>
              <li>我們沒有伺服器端資料庫，因此也沒有其他需要刪除的資料別處。</li>
            </ul>
          </Section>

          <Section title="7. 兒童隱私">
            <p>
              TaskFlow 不會刻意收集 13 歲以下兒童的個人資料。
              如果您認為您的孩子向我們提供了個人資料，請聯絡我們，我們會將其刪除。
            </p>
          </Section>

          <Section title="8. Cookies">
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

          <Section title="9. 您的權利">
            <p>根據 GDPR（通用資料保護規範），您享有以下權利：</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li><strong>知情權</strong>：了解我們收集什麼資料。</li>
              <li><strong>存取權</strong>：隨時匯出您的完整資料。</li>
              <li><strong>更正權</strong>：編輯任務和設定以更正錯誤。</li>
              <li><strong>刪除權</strong>：一鍵清除所有資料。</li>
              <li><strong>資料可攜權</strong>：下載 JSON/CSV 格式的完整備份。</li>
              <li><strong>反對權</strong>：拒絕非必要的 cookies。</li>
            </ul>
          </Section>

          <Section title="10. 國際傳輸">
            <p>
              由於本應用運行在瀏覽器中，資料不會在網路上傳輸到伺服器。
              若您從歐盟地區使用本服務並啟用瀏覽器通知，通知由瀏覽器供應商（Google、Apple 等）處理，
              請參閱其各自的隱私權政策。
            </p>
          </Section>

          <Section title="11. 政策變更">
            <p>
              我們可能不時更新本隱私權政策。任何重大變更都會在此頁面上公告。
              繼續使用 TaskFlow 即表示您接受更新後的政策。
            </p>
          </Section>

          <Section title="12. 聯絡我們">
            如對本隱私權政策有任何疑問或行使您的權利，請聯絡我們：
            <br />
            <span style={{ color: "var(--brand)" }}>support@taskflow.app</span>
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
