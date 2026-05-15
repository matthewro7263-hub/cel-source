const fs = require('fs');
const path = require('path');

const storagePath = path.join(__dirname, '../server/storage.ts');
let content = fs.readFileSync(storagePath, 'utf8');

// Replace .get(), .all(), .run() with await equivalents
// This regex is broad to catch multi-line and single-line
content = content.replace(/\.(get|all|run)\(\)/g, (match, type) => {
  if (type === 'get') return '.then(r => r[0])';
  return '';
});

// Add await to all db calls if not present
// This is tricky but let's try to find db. expressions and ensure they are awaited
content = content.replace(/(?<!await )db\.(select|insert|update|delete|execute)/g, 'await db.$1');

// Ensure functions are async
// Find function signatures and ensure 'async' is present
content = content.replace(/(\b[a-zA-Z0-9_]+\s*:\s*\([^)]*\)\s*=>)/g, (match) => {
  if (match.includes('async')) return match;
  return 'async ' + match;
});

// Remove double awaits
content = content.replace(/await await/g, 'await');

fs.writeFileSync(storagePath, content);
console.log('Brute force storage fix applied.');
