const fs = require('fs');
let content = fs.readFileSync('src/components/AppShell.tsx', 'utf-8');

// Replace all occurrences of onAddToToday={currentSharedListId ? undefined : addToToday}
content = content.replace(/onAddToToday=\{currentSharedListId \? undefined : addToToday\}/g, 'onAddToToday={showFocusNow ? addToToday : undefined}');

// Add onAddToToday to the TaskSwipeWrapper for Shared List rendering
const sharedSwipeWrapperMatch = /<TaskSwipeWrapper taskId=\{task\.id\} isDone=\{task\.status === "done"\} onComplete=\{\(\) => updateSharedTask\(currentSharedListId, task\.id, \{ status: task\.status === "done" \? "todo" : "done" \}\)\} onDelete=\{\(\) => deleteSharedTask\(currentSharedListId, task\.id\)\} onArchive=\{\(\) => updateSharedTask\(currentSharedListId, task\.id, \{ isArchived: true \}\)?>/g;

content = content.replace(sharedSwipeWrapperMatch, '<TaskSwipeWrapper taskId={task.id} isDone={task.status === "done"} onComplete={() => updateSharedTask(currentSharedListId, task.id, { status: task.status === "done" ? "todo" : "done" })} onDelete={() => deleteSharedTask(currentSharedListId, task.id)} onArchive={() => updateSharedTask(currentSharedListId, task.id, { isArchived: true })} onAddToToday={showFocusNow ? addToToday : undefined}>');

fs.writeFileSync('src/components/AppShell.tsx', content);
