const fs = require('fs');
const path = require('path');

const storagePath = path.join(__dirname, '../server/storage.ts');
let lines = fs.readFileSync(storagePath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Find lines that have a fat arrow after what looks like a parameter list
    // Pattern: async name(params): Type => expr
    if (line.match(/^\s*(?:async\s+)?(?:\w+\s*:\s*(?:async\s*)?)?\w+\s*\(.*\)\s*(?::\s*.*)?\s*=>/)) {

        // 1. Convert any name: async (params) => to async name(params) =>
        line = line.replace(/^(\s*)(\w+)\s*:\s*async\s*\(([^)]*)\)/, '$1async $2($3)');
        line = line.replace(/^(\s*)(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*await/, '$1async $2($3) => await');

        // 2. Remove the return type for now (easier to parse)
        line = line.replace(/(\))\s*:\s*[^=>]+\s*=>/, '$1 =>');

        // 3. Convert => expr to { return expr; }
        if (line.includes('=>') && !line.includes('{')) {
            line = line.replace(/=>\s*(.*),\s*$/, '{ return $1; },');
            line = line.replace(/=>\s*(.*)\s*$/, '{ return $1; }');
        }

        // 4. Convert => { to {
        line = line.replace(/=>\s*\{/, '{');

        // 5. Ensure it's in the shorthand form if it's async name(params)
        line = line.replace(/^(\s*)async\s+(\w+)\s*\(([^)]*)\)\s*\{/, '$1async $2($3) {');
    }

    lines[i] = line;
}

fs.writeFileSync(storagePath, lines.join('\n'));
console.log('Aggressively normalized storage.ts signatures.');
