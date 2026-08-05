const fs = require('fs');

let zenDashboard = fs.readFileSync('src/components/ZenDashboard.tsx', 'utf8');
if (!zenDashboard.includes('window.zenDebug')) {
  zenDashboard = zenDashboard.replace(
    'const visibleTasks = useMemo(() => selectZenTasks(tasks, sharedLists), [tasks, sharedLists]);',
    `const visibleTasks = useMemo(() => {
    const res = selectZenTasks(tasks, sharedLists);
    // @ts-ignore
    window.zenDebug = { tasks: tasks.length, shared: Object.values(sharedLists).flatMap(l => l.tasks).filter(t => t.dueDate === getLocalToday()).length, res: res.length };
    return res;
  }, [tasks, sharedLists]);`
  );
  
  zenDashboard = zenDashboard.replace(
    'return (',
    'return (\n    <>\n      <div className="fixed top-0 left-0 w-full bg-black text-green-400 z-[9999] p-2 text-xs font-mono">\n        ZenDebug: {JSON.stringify(typeof window !== "undefined" ? (window as any).zenDebug : {})}\n      </div>'
  );
  
  zenDashboard = zenDashboard.replace(
    '</main>',
    '</main>\n    </>'
  );

  fs.writeFileSync('src/components/ZenDashboard.tsx', zenDashboard);
}
console.log("Patched ZenDashboard");
