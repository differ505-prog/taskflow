import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服務條款",
  description: "TaskFlow 服務條款與使用協議",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--surface-muted)" }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-[28px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            服務條款
          </h1>
          <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
            最後更新：2026 年 7 月 7 日
          </p>
        </div>

        <div className="card p-8 space-y-8" style={{ color: "var(--text-secondary)" }}>
          <Section title="1. 服務說明">
            TaskFlow 是一款基於瀏覽器的任務管理工具（「服務」）。
            服務由經營者（以下簡稱「我們」）提供。我們保留隨時修改或終止服務的權利，
            並會透過網站公告或應用程式內通知提前告知。
          </Section>

          <Section title="2. 使用資格">
            您必須年滿 13 歲才能使用本服務。使用本服務即表示您聲明並保證您具備訂立本合約的法律權限。
          </Section>

          <Section title="3. 資料儲存">
            TaskFlow 預設使用瀏覽器本地儲存（localStorage）儲存您的資料。
            我們不保證資料的永久保存，您有責任定期匯出資料備份。
            若因瀏覽器清除資料、裝置故障或其他原因導致資料遺失，我們不承擔責任。
          </Section>

          <Section title="4. 隱私與資料">
            我們重視您的隱私權。有關我們如何收集、使用和保護您的資料，請參閱我們的隱私權政策。
            使用本服務即表示您同意我們依隱私權政策處理您的資料。
          </Section>

          <Section title="5. 公平使用">
            您同意不：
            <ul className="list-disc list-inside mt-2 space-y-1 text-[14px]">
              <li>使用自動化工具大量干擾服務正常運作</li>
              <li>嘗試未經授權存取服務或相關系統</li>
              <li>上傳含有惡意程式碼或有害內容的資料</li>
              <li>轉售或商業利用本服務</li>
            </ul>
          </Section>

          <Section title="6. 服務變更與中斷">
            我們可能不時更新服務。服務可能因維護、升級或不可抗力因素而中斷。
            我們不對服務中斷導致的任何損失負責，但會盡合理努力提前通知。
          </Section>

          <Section title="7. 智慧財產權">
            TaskFlow 的名稱、標誌、設計及所有相關內容均為我們的財產，受智慧財產權法律保護。
            未经授权，不得複製、修改或散佈。
          </Section>

          <Section title="8. 責任限制">
            在適用法律允許的最大範圍內，我們不對任何間接、附帶、特殊或衍生性損失負責，
            包括但不限於利潤損失、資料遺失或商譽損失，即使已被告知可能發生此類損失。
          </Section>

          <Section title="9. 終止">
            我們可基於任何原因（包括違反本條款）終止您對服務的存取權。
            若您希望終止帳戶，可清除瀏覽器中的所有資料。
          </Section>

          <Section title="10. 條款修改">
            我們保留隨時修改本條款的權利。修改後的條款會在本頁面上公告。
            繼續使用服務即表示您接受修改後的條款。
          </Section>

          <Section title="11. 適用法律">
            本條款受中華民國（台灣）法律管轄，並依其解釋。
            因本條款引起或與之相關的任何爭議，應提交台灣有管轄權的法院解決。
          </Section>

          <Section title="12. 聯絡我們">
            如對本服務條款有任何疑問，請透過以下方式聯絡我們：
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
