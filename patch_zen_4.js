const fs = require('fs');
let zenDashboard = fs.readFileSync('src/components/ZenDashboard.tsx', 'utf8');
zenDashboard = zenDashboard.replace(
  'window.zenDebug = { sharedMatched: Object.values(sharedLists).flatMap(l => l.tasks).filter(t => t.dueDate === getLocalToday()).map(t => t.title), allSharedTitles: Object.values(sharedLists).flatMap(l => l.tasks).map(t => t.title) };',
  'window.zenDebug = { taskObj: Object.values(sharedLists).flatMap(l => l.tasks).find(t => t.title === "買輕鋼架9片") };'
);
fs.writeFileSync('src/components/ZenDashboard.tsx', zenDashboard);
console.log("Patched ZenDashboard 4");
