const fs = require('fs');
let content = fs.readFileSync('src/components/AppShell.tsx', 'utf-8');

const oldHandleFocusNow = /const handleFocusNow = useCallback\(\(taskId: string\) => \{[\s\S]*?router\.push\("\/"\);\s*\}, \[.*?\]\);/;

const newHandleFocusNow = `const handleFocusNow = useCallback((taskId: string) => {
    const today = new Date().toLocaleDateString("en-CA");
    
    let targetSharedListId: string | undefined;
    for (const [listId, data] of Object.entries(sharedLists)) {
      if (data.tasks.some(t => t.id === taskId)) {
        targetSharedListId = listId;
        break;
      }
    }

    if (targetSharedListId) {
      updateSharedTask(targetSharedListId, taskId, { dueDate: today, order: -1 });
    } else {
      updateTask(taskId, { dueDate: today, order: -1 });
    }
    
    dismissAddToTodayToast();
    router.push("/");
  }, [updateTask, updateSharedTask, sharedLists, router, dismissAddToTodayToast]);`;

content = content.replace(oldHandleFocusNow, newHandleFocusNow);

const oldAddToToday = /const addToToday = useCallback\(\(taskId: string\) => \{[\s\S]*?showAddToTodayToast\(taskId\);\s*\}, \[.*?\]\);/;

const newAddToToday = `const addToToday = useCallback((taskId: string) => {
    const today = new Date().toLocaleDateString("en-CA");
    let targetSharedListId: string | undefined;
    for (const [listId, data] of Object.entries(sharedLists)) {
      if (data.tasks.some(t => t.id === taskId)) {
        targetSharedListId = listId;
        break;
      }
    }

    if (targetSharedListId) {
      updateSharedTask(targetSharedListId, taskId, { dueDate: today });
    } else {
      updateTask(taskId, { dueDate: today });
    }
    showAddToTodayToast(taskId);
  }, [updateTask, updateSharedTask, sharedLists, showAddToTodayToast]);`;

content = content.replace(oldAddToToday, newAddToToday);

fs.writeFileSync('src/components/AppShell.tsx', content);
