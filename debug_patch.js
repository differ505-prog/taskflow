const fs = require('fs');

let appShell = fs.readFileSync('src/components/AppShell.tsx', 'utf8');
if (!appShell.includes('setDebugLog')) {
  appShell = appShell.replace(
    'const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);',
    'const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);\n  const [debugLog, setDebugLog] = useState<string[]>([]);\n  // @ts-ignore\n  window.appDebug = (msg: string) => setDebugLog(prev => [...prev, msg].slice(-10));'
  );
  
  appShell = appShell.replace(
    '{currentView === "today" && (',
    '{debugLog.length > 0 && <div className="p-4 bg-black text-green-400 font-mono text-xs z-50 overflow-auto">{debugLog.map((l,i) => <div key={i}>{l}</div>)}</div>}\n            {currentView === "today" && ('
  );

  appShell = appShell.replace(
    'updateSharedTask(targetSharedListId, taskId, { dueDate: today, order: -1 });',
    '// @ts-ignore\n      window.appDebug?.(`updateSharedTask called! sid=${targetSharedListId}`);\n      updateSharedTask(targetSharedListId, taskId, { dueDate: today, order: -1 });'
  );
  
  appShell = appShell.replace(
    'updateTask(taskId, { dueDate: today, order: -1 });',
    '// @ts-ignore\n      window.appDebug?.(`updateTask called! No target sid found!`);\n      updateTask(taskId, { dueDate: today, order: -1 });'
  );
  
  fs.writeFileSync('src/components/AppShell.tsx', appShell);
}

let appContext = fs.readFileSync('src/lib/AppContext.tsx', 'utf8');
if (!appContext.includes('window.appDebug?.(`updateSharedTask inside:')) {
  appContext = appContext.replace(
    'const updatedData: SharedListData = { ...data, tasks: updatedTasks };',
    '// @ts-ignore\n    window.appDebug?.(`updateSharedTask inside: found data, updated ${updatedTasks.length} tasks`);\n    const updatedData: SharedListData = { ...data, tasks: updatedTasks };'
  );
  
  appContext = appContext.replace(
    'console.warn("[Shared] Viewer cannot edit tasks");',
    '// @ts-ignore\n      window.appDebug?.(`canEditSharedList returned FALSE for ${sharedListId}`);\n      console.warn("[Shared] Viewer cannot edit tasks");'
  );
  fs.writeFileSync('src/lib/AppContext.tsx', appContext);
}
console.log("Patched with debug UI");
