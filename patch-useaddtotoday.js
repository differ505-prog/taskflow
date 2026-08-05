const fs = require('fs');
let content = fs.readFileSync('src/hooks/useAddToToday.ts', 'utf-8');

const oldUpdate = /updateTask\(taskId, \{ dueDate: today \}\);/g;
const newUpdate = `let targetSharedListId: string | undefined;
      for (const [listId, data] of Object.entries(useApp().sharedLists)) {
        if (data.tasks.some(t => t.id === taskId)) {
          targetSharedListId = listId;
          break;
        }
      }

      if (targetSharedListId) {
        useApp().updateSharedTask(targetSharedListId, taskId, { dueDate: today });
      } else {
        updateTask(taskId, { dueDate: today });
      }`;

content = content.replace(oldUpdate, newUpdate);
// Need to properly inject sharedLists, updateSharedTask from useApp
content = content.replace('const { updateTask } = useApp();', 'const { updateTask, updateSharedTask, sharedLists } = useApp();');
content = content.replace(/useApp\(\)\.sharedLists/g, 'sharedLists');
content = content.replace(/useApp\(\)\.updateSharedTask/g, 'updateSharedTask');

fs.writeFileSync('src/hooks/useAddToToday.ts', content);
