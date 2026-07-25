/**
 * VibeList 防禦性客戶成功 Email 系統
 *
 * 使用方式：
 *   import { renderAmnestiaEmail, renderWeeklyReportEmail } from "@/emails";
 *
 * 模板：
 *   - AmnestiaEmail  / renderAmnestiaEmail  → 3 天未登入喚回信
 *   - WeeklyReportEmail / renderWeeklyReportEmail → 每週五活躍用戶戰報
 *
 * 觸發方式（見 api/email/cs/route.ts）：
 *   - Vercel Cron Job： GET /api/email/cs?type=amnestia
 *   - Vercel Cron Job： GET /api/email/cs?type=weekly_report
 */

export {
  AmnestiaEmail,
  renderAmnestiaEmail,
} from "./AmnestiaEmail";

export {
  WeeklyReportEmail,
  renderWeeklyReportEmail,
} from "./WeeklyReportEmail";
