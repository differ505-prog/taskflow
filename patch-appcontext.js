const fs = require('fs');
let content = fs.readFileSync('src/lib/AppContext.tsx', 'utf-8');

// 1. Fix the view state sync
const oldEffect = /const view = searchParams\.get\("view"\) as AppView \| null;\s*const listId = searchParams\.get\("listId"\);\s*const sharedId = searchParams\.get\("sharedListId"\);\s*if \(view && view !== currentViewState\) setCurrentViewState\(view\);/;

const newEffect = `const view = (searchParams.get("view") as AppView) || "today";
    const listId = searchParams.get("listId");
    const sharedId = searchParams.get("sharedListId");

    if (view !== currentViewState) setCurrentViewState(view);`;

content = content.replace(oldEffect, newEffect);

// 2. Fix the getFilteredTasks dependencies
const oldDeps = /\}, \[tasks, currentView, currentListId, searchQuery, activeFilter\]\);/;
const newDeps = `}, [tasks, currentView, currentListId, searchQuery, activeFilter, sharedLists]);`;
content = content.replace(oldDeps, newDeps);

fs.writeFileSync('src/lib/AppContext.tsx', content);
