const fs = require('fs');
let content = fs.readFileSync('src/components/TaskDetailPanel.tsx', 'utf-8');

content = content.replace(/useState<string\[\]>\(task\.tags\)/g, 'useState<string[]>(task.tags || [])');
content = content.replace(/setTags\(task\.tags\)/g, 'setTags(task.tags || [])');
content = content.replace(/tags\.length > 0/g, '(tags || []).length > 0');
content = content.replace(/tags\.map/g, '(tags || []).map');
content = content.replace(/tags\.includes/g, '(tags || []).includes');

fs.writeFileSync('src/components/TaskDetailPanel.tsx', content);
