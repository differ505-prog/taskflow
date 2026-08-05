const fs = require('fs');
let content = fs.readFileSync('src/components/CommandCenter.tsx', 'utf-8');

const hookStart = /const { tasks, updateTask, toggleTaskStatus } = useApp\(\);/;
const hookReplace = `const { tasks, sharedLists, updateTask, updateSharedTask, toggleTaskStatus } = useApp();
  const allTasks = useMemo(() => {
    const sharedTasks = Object.values(sharedLists || {}).flatMap((listData) => listData.tasks);
    return [...tasks, ...sharedTasks];
  }, [tasks, sharedLists]);`;

content = content.replace(hookStart, hookReplace);

// find all references to tasks.filter and replace with allTasks.filter
content = content.replace(/tasks\.filter/g, 'allTasks.filter');
// find tasks.find
content = content.replace(/tasks\.find/g, 'allTasks.find');
// find useWeekGrid({ tasks,
content = content.replace(/useWeekGrid\(\{\n\s*tasks,/g, 'useWeekGrid({\n    tasks: allTasks,');

// replace dragging logic
const dragRegex = /const task = tasks\.find\(\(t\) => t\.id === draggingId\);\n\s*if \(task\) \{\n\s*updateTask\(draggingId, \{ startDate: dateStr, dueDate: dateStr \}\);\n\s*\}/;
const dragReplace = `const task = allTasks.find((t) => t.id === draggingId);
    if (task) {
      const isShared = task.listId && sharedLists[task.listId];
      if (isShared) {
        updateSharedTask(task.listId!, draggingId, { startDate: dateStr, dueDate: dateStr });
      } else {
        updateTask(draggingId, { startDate: dateStr, dueDate: dateStr });
      }
    }`;
content = content.replace(dragRegex, dragReplace);

// useWeekGrid onUpdateTaskDates callback
const weekGridRegex = /onUpdateTaskDates: \(taskId, startDate, dueDate\) => updateTask\(taskId, \{ startDate, dueDate \}\),/;
const weekGridReplace = `onUpdateTaskDates: (taskId, startDate, dueDate) => {
      const task = allTasks.find(t => t.id === taskId);
      if (task) {
        const isShared = task.listId && sharedLists[task.listId];
        if (isShared) {
          updateSharedTask(task.listId!, taskId, { startDate, dueDate });
        } else {
          updateTask(taskId, { startDate, dueDate });
        }
      }
    },`;
content = content.replace(weekGridRegex, weekGridReplace);

fs.writeFileSync('src/components/CommandCenter.tsx', content);
