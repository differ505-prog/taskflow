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
  
  if (content.includes('toLocaleDateString("en-CA")')) {
    if (!content.includes('getLocalToday')) {
      content = 'import { getLocalToday } from "@/lib/dateUtils";\n' + content;
    }
    content = content.replace(/new Date\(\)\.toLocaleDateString\("en-CA"\)/g, 'getLocalToday()');
    fs.writeFileSync(file, content);
  }
}
