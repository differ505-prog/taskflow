const fs = require('fs');
let content = fs.readFileSync('src/components/CommandCenter.tsx', 'utf-8');

// Fix selectBacklog and similar functions
content = content.replace(/function selectBacklog\(tasks: Task\[\]\): Task\[\] \{\n\s*return allTasks\.filter/g, 'function selectBacklog(tasks: Task[]): Task[] {\n  return tasks.filter');
content = content.replace(/function selectNext7Days\(tasks: Task\[\]\): Task\[\] \{\n\s*const today = getLocalToday\(\);\n\s*const limit = new Date\(today\);\n\s*limit\.setDate\(limit\.getDate\(\) \+ 7\);\n\s*const limitStr = limit\.toISOString\(\)\.split\("T"\)\[0\];\n\s*return allTasks\.filter/g, 
  'function selectNext7Days(tasks: Task[]): Task[] {\n  const today = getLocalToday();\n  const limit = new Date(today);\n  limit.setDate(limit.getDate() + 7);\n  const limitStr = limit.toISOString().split("T")[0];\n  return tasks.filter');

fs.writeFileSync('src/components/CommandCenter.tsx', content);
