const fs = require('fs');
let content = fs.readFileSync('src/components/AppShell.tsx', 'utf-8');

const targetStr = '<TaskSwipeWrapper taskId={task.id} isDone={task.status === "done"} onComplete={() => updateSharedTask(currentSharedListId, task.id, { status: task.status === "done" ? "todo" : "done" })} onDelete={() => deleteSharedTask(currentSharedListId, task.id)} onArchive={() => updateSharedTask(currentSharedListId, task.id, { isArchived: true })}>';

const replaceStr = '<TaskSwipeWrapper taskId={task.id} isDone={task.status === "done"} onComplete={() => updateSharedTask(currentSharedListId, task.id, { status: task.status === "done" ? "todo" : "done" })} onDelete={() => deleteSharedTask(currentSharedListId, task.id)} onArchive={() => updateSharedTask(currentSharedListId, task.id, { isArchived: true })} onAddToToday={showFocusNow ? addToToday : undefined}>';

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/AppShell.tsx', content);
