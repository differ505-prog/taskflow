const fs = require('fs');
let zenDashboard = fs.readFileSync('src/components/ZenDashboard.tsx', 'utf8');

// The line we added was:
// window.zenDebug = { taskObj: Object.values(sharedLists).flatMap(l => l.tasks).find(t => t.title === "買輕鋼架9片") };
// But wait, the banner was:
/*
      {/* 臨時除錯資訊 *}
      <div className="bg-black text-green-400 p-2 text-xs font-mono break-all relative z-[9999]">
        ZenDebug: {JSON.stringify(typeof window !== 'undefined' ? (window as any).zenDebug : null)}
      </div>
*/

const searchStr = `
      {/* 臨時除錯資訊 */}
      <div className="bg-black text-green-400 p-2 text-xs font-mono break-all relative z-[9999]">
        ZenDebug: {JSON.stringify(typeof window !== 'undefined' ? (window as any).zenDebug : null)}
      </div>`;

zenDashboard = zenDashboard.replace(searchStr, '');
zenDashboard = zenDashboard.replace('window.zenDebug = { taskObj: Object.values(sharedLists).flatMap(l => l.tasks).find(t => t.title === "買輕鋼架9片") };', '');

fs.writeFileSync('src/components/ZenDashboard.tsx', zenDashboard);
console.log("Reverted ZenDashboard");
