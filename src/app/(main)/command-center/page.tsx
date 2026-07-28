import CommandCenterClient from "./CommandCenterClient";

export const metadata = {
  title: "Command Center · VibeList",
  description: "戰略排程模式：拖曳待命任務到日曆任一日期",
};

// 向後相容:直接打 /command-center 仍可進入軍機處
// 但建議從禪模式「任務大廳」→ 軍機處切換面板進入,UX 更順
export default function CommandCenterPage() {
  return <CommandCenterClient />;
}
