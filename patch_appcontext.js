const fs = require('fs');
let code = fs.readFileSync('src/lib/AppContext.tsx', 'utf8');

// Add to interface
code = code.replace(
  '  reorderTasks: (reorderedTasks: Task[]) => void;',
  '  reorderTasks: (reorderedTasks: Task[]) => void;\n  saveTasksDirectly: (updatedTasks: Task[]) => void;'
);

// Add implementation
const reorderTasksImpl = `
  const reorderTasks = useCallback((reorderedTasks: Task[]) => {
    if (reorderedTasks.length === 0) return;
    const now = new Date().toISOString();
    // 重編 order,保留其他欄位
    const updated: Task[] = reorderedTasks.map((t, idx) => ({
      ...t,
      order: idx,
      updatedAt: now,
    }));
    setTasks(updated);
    saveTasks(updated);
    if (user) {
      batchSaveTasksFirebase(user.uid, updated).catch(console.error);
    }
  }, [user]);`;

const saveTasksDirectlyImpl = `
  const saveTasksDirectly = useCallback((updatedTasks: Task[]) => {
    if (updatedTasks.length === 0) return;
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    if (user) {
      batchSaveTasksFirebase(user.uid, updatedTasks).catch(console.error);
    }
  }, [user]);`;

code = code.replace(reorderTasksImpl, reorderTasksImpl + '\n' + saveTasksDirectlyImpl);

// Add to returned context
code = code.replace(
  '    reorderTasks,\n    escapeTask,',
  '    reorderTasks,\n    saveTasksDirectly,\n    escapeTask,'
);

fs.writeFileSync('src/lib/AppContext.tsx', code);
console.log("Patched AppContext.tsx");
