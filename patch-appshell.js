const fs = require('fs');
const content = fs.readFileSync('src/components/AppShell.tsx', 'utf-8');

const replacement = `  const routeUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    const task = [...activeTasks, ...completedTasks].find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      updateSharedTask(task.listId!, taskId, updates);
    } else {
      updateTask(taskId, updates);
    }
  }, [activeTasks, completedTasks, sharedLists, updateSharedTask, updateTask]);

  const routeCompleteTask = useCallback((taskId: string) => {
    const task = [...activeTasks, ...completedTasks].find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      updateSharedTask(task.listId!, taskId, { status: task.status === "done" ? "todo" : "done" });
      if (task.status === "todo") {
        import("@/lib/confetti").then(m => { m.fireTaskDoneConfetti(); m.playTaskDoneSound(); });
      }
    } else {
      completeTask(taskId);
    }
  }, [activeTasks, completedTasks, sharedLists, updateSharedTask, completeTask]);

  const routeDeleteTask = useCallback((taskId: string) => {
    const task = [...activeTasks, ...completedTasks].find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      deleteSharedTask(task.listId!, taskId);
    } else {
      deleteTask(taskId);
    }
  }, [activeTasks, completedTasks, sharedLists, deleteSharedTask, deleteTask]);

  const routeToggleSubTask = useCallback((taskId: string, subId: string) => {
    const task = [...activeTasks, ...completedTasks].find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      const sub = task.subtasks?.find(s => s.id === subId);
      if (!sub) return;
      const updatedSubtasks = task.subtasks!.map(s => s.id === subId ? { ...s, isDone: !s.isDone } : s);
      updateSharedTask(task.listId!, taskId, { subtasks: updatedSubtasks });
    } else {
      toggleSubTask(taskId, subId);
    }
  }, [activeTasks, completedTasks, sharedLists, updateSharedTask, toggleSubTask]);

  const stats =`;

const updated = content.replace('  const stats =', replacement);
fs.writeFileSync('src/components/AppShell.tsx', updated);
