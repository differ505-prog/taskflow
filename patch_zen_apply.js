const fs = require('fs');
let code = fs.readFileSync('src/components/ZenDashboard.tsx', 'utf8');

// Replace `reorderTasks,` with `reorderTasks, saveTasksDirectly,`
code = code.replace(
  'const { tasks, toggleTaskStatus, completeTask, reorderTasks, updateTask, escapeTask, sharedLists, updateSharedTask } = useApp();',
  'const { tasks, toggleTaskStatus, completeTask, reorderTasks, saveTasksDirectly, updateTask, escapeTask, sharedLists, updateSharedTask } = useApp();'
);

code = code.replace(
  '  }, [sharedLists, tasks, reorderTasks, updateSharedTask]);',
  '  }, [sharedLists, tasks, saveTasksDirectly, updateSharedTask]);'
);

const oldImpl = `    // 分離個人任務與共用任務，分別持久化 order
    const personalQueue = newQueue.filter((t) => !t.listId || !sharedLists[t.listId]);
    const todayPersonalIds = new Set(personalQueue.map((t) => t.id));
    const otherPersonalTasks = tasks.filter((t) => !todayPersonalIds.has(t.id));
    reorderTasks([...personalQueue, ...otherPersonalTasks]);`;

const newImpl = `    // 分離個人任務與共用任務，分別持久化 order
    const personalQueue = newQueue.filter((t) => !t.listId || !sharedLists[t.listId]);
    const todayPersonalIds = new Set(personalQueue.map((t) => t.id));
    
    // 確保未顯示的個人任務也有唯一的 order，避免和 today 的任務碰撞
    let nextOrder = newQueue.length;
    const otherPersonalTasks = tasks
      .filter((t) => !todayPersonalIds.has(t.id))
      .map(t => ({ ...t, order: nextOrder++ }));
      
    // 使用 saveTasksDirectly 直接儲存已經帶有正確 order 的陣列 (避免 reorderTasks 強制洗牌)
    saveTasksDirectly([...personalQueue, ...otherPersonalTasks]);`;

code = code.replace(oldImpl, newImpl);

fs.writeFileSync('src/components/ZenDashboard.tsx', code);
console.log("Patched ZenDashboard.tsx");
