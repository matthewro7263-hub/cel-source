const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../shared');
const files = fs.readdirSync(dir).filter(f => f.endsWith('_schema.ts') || f === 'schema.ts');

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/drizzle-orm\/sqlite-core/g, 'drizzle-orm/pg-core');
  content = content.replace(/\bsqliteTable\b/g, 'pgTable');

  content = content.replace(/integer\(([^)]+)\)\.primaryKey\(\{ autoIncrement: true \}\)/g, 'serial($1).primaryKey()');

  // NOTE: do not use mode: "boolean" or mode: "number" with integer in pg
  content = content.replace(/integer\(([^,]+),\s*\{\s*mode:\s*["']boolean["']\s*\}\)/g, 'boolean($1)');
  content = content.replace(/integer\(([^,]+),\s*\{\s*mode:\s*["']number["']\s*\}\)/g, 'integer($1)');

  // Add missing imports
  if (content.includes('serial(') && !content.includes('serial,')) {
    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]drizzle-orm\/pg-core['"]/, (match, p1) => {
      return `import {${p1}, serial} from "drizzle-orm/pg-core"`;
    });
  }
  if (content.includes('boolean(') && !content.includes('boolean,')) {
    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]drizzle-orm\/pg-core['"]/, (match, p1) => {
      return `import {${p1}, boolean} from "drizzle-orm/pg-core"`;
    });
  }

  fs.writeFileSync(filePath, content);
  console.log('Migrated', file);
}
