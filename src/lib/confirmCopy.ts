/**
 * 確認對話框動詞庫（SSOT — 對齊 VOICE_AND_TONE.md §4）
 *
 * 設計原則：
 * - 主按鈕永遠是「動作動詞」，禁用「確認」「確定」這種抽象詞
 * - 副按鈕永遠是「取消」「返回」「先不要」
 * - 動作動詞讀出來是「按下去會發生什麼」
 *
 * 用法：
 *   confirm({ tone: "danger", title: "刪除這個清單？", message: "...", ...copy.delete })
 *   confirm({ tone: "danger", title: "刪除這個清單？", message: "...", ...copy.dismiss })
 */

export const confirmCopy = {
  /** 永久刪除、不可逆 */
  delete: {
    confirmText: "永久刪除",
    cancelText: "先不要",
  },
  /** 一般刪除（可從垃圾桶復原） */
  remove: {
    confirmText: "拿掉",
    cancelText: "先不要",
  },
  /** 封存（LostAndFound 風格的溫柔動詞） */
  dismiss: {
    confirmText: "無罪赦免",
    cancelText: "先不要",
  },
  /** 暫時放下 / 暫緩 */
  defer: {
    confirmText: "放下",
    cancelText: "先不要",
  },
  /** 覆寫/替換 */
  replace: {
    confirmText: "改為",
    cancelText: "先不要",
  },
  /** 登出 */
  signOut: {
    confirmText: "登出",
    cancelText: "先不要",
  },
  /** 中斷/離開 */
  leave: {
    confirmText: "離開這裡",
    cancelText: "留下",
  },
  /** 預設（無明確動作） */
  default: {
    confirmText: "好，下一步",
    cancelText: "先不要",
  },
} as const;

export type ConfirmCopyKey = keyof typeof confirmCopy;
