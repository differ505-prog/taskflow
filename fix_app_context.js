const fs = require('fs');
const content = fs.readFileSync('src/lib/AppContext.tsx', 'utf8');

const target1 = `(t) => !fbIds.has(t.id) && (!t.ownerUid || t.ownerUid === user.uid)`;
const replacement1 = `(t) => !fbIds.has(t.id) && (!t.listId || !sharedListsRef.current[t.listId])`;

const newContent = content.replace(target1, replacement1);

if (newContent !== content) {
  fs.writeFileSync('src/lib/AppContext.tsx', newContent);
  console.log("Fixed localOnly logic in AppContext.tsx");
} else {
  console.log("Target not found or already replaced");
}
