const fs = require('fs');
let content = fs.readFileSync('src/components/CalendarView.tsx', 'utf-8');

const hookStart = /const { tasks, updateTask, toggleTaskStatus, completeTask, addTask, deleteTask, searchQuery } = useApp\(\);/;
const hookReplace = `const { tasks, sharedLists, updateTask, updateSharedTask, toggleTaskStatus, completeTask, addTask, deleteTask, searchQuery } = useApp();
  const allTasks = useMemo(() => {
    const sharedTasks = Object.values(sharedLists || {}).flatMap((listData) => listData.tasks);
    return [...tasks, ...sharedTasks];
  }, [tasks, sharedLists]);`;

content = content.replace(hookStart, hookReplace);

content = content.replace(/tasks: tasks,/g, 'tasks: allTasks,');
content = content.replace(/tasks=\{tasks\}/g, 'tasks={allTasks}');

// Update hookHandleDrop or handleDrop to use updateSharedTask if needed
const dropRegex = /updateTask\(draggingTaskId, \{ startDate: dateStr, dueDate: dateStr \}\);/;
const dropReplace = `
      // try to find if it's shared
      let targetSharedListId: string | undefined;
      for (const [listId, data] of Object.entries(sharedLists)) {
        if (data.tasks.some(t => t.id === draggingTaskId)) {
          targetSharedListId = listId;
          break;
        }
      }
      if (targetSharedListId) {
        updateSharedTask(targetSharedListId, draggingTaskId, { startDate: dateStr, dueDate: dateStr });
      } else {
        updateTask(draggingTaskId, { startDate: dateStr, dueDate: dateStr });
      }`;
content = content.replace(dropRegex, dropReplace);

// replace useMonthGrid usage
const monthGridRegex = /tasks,\s+searchQuery,\s+onUpdateTaskDates: \(taskId, startDate, dueDate\) =>\s+updateTask\(taskId, \{ startDate, dueDate \}\),/m;
const monthGridReplace = `tasks: allTasks,
    searchQuery,
    onUpdateTaskDates: (taskId, startDate, dueDate) => {
      let targetSharedListId: string | undefined;
      for (const [listId, data] of Object.entries(sharedLists)) {
        if (data.tasks.some(t => t.id === taskId)) {
          targetSharedListId = listId;
          break;
        }
      }
      if (targetSharedListId) {
        updateSharedTask(targetSharedListId, taskId, { startDate, dueDate });
      } else {
        updateTask(taskId, { startDate, dueDate });
      }
    },`;
content = content.replace(monthGridRegex, monthGridReplace);

// also fix useMonthGrid tasks parameter inside CalendarView if needed
// wait, the regex above handles it.

fs.writeFileSync('src/components/CalendarView.tsx', content);
