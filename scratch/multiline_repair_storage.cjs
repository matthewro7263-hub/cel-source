const fs = require('fs');
const path = require('path');

const storagePath = path.join(__dirname, '../server/storage.ts');
let content = fs.readFileSync(storagePath, 'utf8');

// Use a regex that matches across multiple lines for the specific storage method patterns
// We look for: (async )?name(args): Type => (await )?db...
// This is very specific but it should work for this file.

// Pattern 1: async name(params) => expr (possibly multiline)
content = content.replace(/async\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>\s*([^,;{\n]+(?:(?:\n\s*)[^,;{\n]+)*)/g, (match, name, params, body) => {
    return `async ${name}(${params}) { return ${body.trim()}; }`;
});

// Pattern 2: name: async (params) => expr (possibly multiline)
content = content.replace(/(\w+)\s*:\s*async\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>\s*([^,;{\n]+(?:(?:\n\s*)[^,;{\n]+)*)/g, (match, name, params, body) => {
    return `async ${name}(${params}) { return ${body.trim()}; }`;
});

// Pattern 3: name: (params) => await expr (possibly multiline)
content = content.replace(/(\w+)\s*:\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>\s*(await\s+[^,;{\n]+(?:(?:\n\s*)[^,;{\n]+)*)/g, (match, name, params, body) => {
    return `async ${name}(${params}) { return ${body.trim()}; }`;
});

// Pattern 4: async name(params) => { ... }
content = content.replace(/async\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>\s*\{/g, 'async $1($2) {');

// Cleanup: If we re-introduced any double asyncs
content = content.replace(/async\s+async/g, 'async');

fs.writeFileSync(storagePath, content);
console.log('Fixed multiline storage.ts syntax.');
