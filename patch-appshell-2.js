const fs = require('fs');
let content = fs.readFileSync('src/components/AppShell.tsx', 'utf-8');

// Replace the callbacks in TaskSwipeWrapper and SortableTaskItem inside activeTasks mapping
content = content.replace(
/onComplete=\{\(\) => updateTask\(task\.id, \{ status: task\.status === "done" \? "todo" : "done" \}\)\}/g,
`onComplete={() => routeCompleteTask(task.id)}`
);
content = content.replace(
/onDelete=\{\(id\) => deleteTask\(id\)\}/g,
`onDelete={(id) => routeDeleteTask(id)}`
);
content = content.replace(
/onToggleStatus=\{completeTask\}/g,
`onToggleStatus={routeCompleteTask}`
);
content = content.replace(
/onToggleSubTask=\{toggleSubTask\}/g,
`onToggleSubTask={routeToggleSubTask}`
);
content = content.replace(
/onUpdatePriority=\{\(id, p\) => updateTask\(id, \{ priority: p \}\)\}/g,
`onUpdatePriority={(id, p) => routeUpdateTask(id, { priority: p })}`
);
content = content.replace(
/onUpdateTags=\{\(id, tags\) => updateTask\(id, \{ tags \}\)\}/g,
`onUpdateTags={(id, tags) => routeUpdateTask(id, { tags })}`
);
content = content.replace(
/onTogglePin=\{\(id\) => updateTask\(id, \{ isPinned: !tasks\.find\(t => t\.id === id\)\?\.isPinned \}\)\}/g,
`onTogglePin={(id) => routeUpdateTask(id, { isPinned: !tasks.find(t => t.id === id)?.isPinned })}`
);

fs.writeFileSync('src/components/AppShell.tsx', content);
