const fs = require('fs');
const path = require('path');

const storagePath = path.join(__dirname, '../server/storage.ts');
let lines = fs.readFileSync(storagePath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Pattern: async name(params) => expr
    // We match the part after => until the end of the line, keeping the trailing comma if present
    const match = line.match(/^(\s*)async\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>\s*(.*)$/);
    if (match) {
        const indent = match[1];
        const name = match[2];
        const params = match[3];
        let body = match[4].trim();

        let trailingComma = '';
        if (body.endsWith(',')) {
            body = body.slice(0, -1);
            trailingComma = ',';
        }

        if (body.startsWith('{')) {
            // Already has a block, just fix the =>
            line = `${indent}async ${name}(${params}) ${body}${trailingComma}`;
        } else {
            line = `${indent}async ${name}(${params}) { return ${body}; }${trailingComma}`;
        }
    }

    // Pattern: name: async (params) => expr
    const match2 = line.match(/^(\s*)(\w+)\s*:\s*async\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>\s*(.*)$/);
    if (match2) {
        const indent = match2[1];
        const name = match2[2];
        const params = match2[3];
        let body = match2[4].trim();

        let trailingComma = '';
        if (body.endsWith(',')) {
            body = body.slice(0, -1);
            trailingComma = ',';
        }

        if (body.startsWith('{')) {
            line = `${indent}async ${name}(${params}) ${body}${trailingComma}`;
        } else {
            line = `${indent}async ${name}(${params}) { return ${body}; }${trailingComma}`;
        }
    }

    // Pattern: name: (params) => await expr
    const match3 = line.match(/^(\s*)(\w+)\s*:\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>\s*(await.*)$/);
    if (match3) {
        const indent = match3[1];
        const name = match3[2];
        const params = match3[3];
        let body = match3[4].trim();

        let trailingComma = '';
        if (body.endsWith(',')) {
            body = body.slice(0, -1);
            trailingComma = ',';
        }

        line = `${indent}async ${name}(${params}) { return ${body}; }${trailingComma}`;
    }

    lines[i] = line;
}

fs.writeFileSync(storagePath, lines.join('\n'));
console.log('Fixed storage.ts syntax with line-based regex.');
