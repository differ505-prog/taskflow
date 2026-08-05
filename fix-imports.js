const fs = require('fs');

const files = [
  'src/components/AppShell.tsx',
  'src/components/ZenDashboard.tsx',
  'src/hooks/useAddToToday.ts',
  'src/components/LostAndFound.tsx',
  'src/components/OnboardingTask.tsx',
  'src/lib/AppContext.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');
  
  if (content.startsWith('import { getLocalToday }') && content.includes('"use client"')) {
    content = content.replace('import { getLocalToday } from "@/lib/dateUtils";\n"use client";\n', '"use client";\nimport { getLocalToday } from "@/lib/dateUtils";\n');
    fs.writeFileSync(file, content);
  }
}
