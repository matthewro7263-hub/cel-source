const fs = require('fs');
const path = require('path');

const storagePath = path.join(__dirname, '../server/storage.ts');
let lines = fs.readFileSync(storagePath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Fix: async name(params): Type => expr
    if (line.match(/^\s*async\s+\w+\s*\(.*\)\s*(?::\s*[^=]+)?\s*=>\s*[^\{]/)) {
        line = line.replace(/=>\s*(.*),\s*$/, '{ return $1; },');
        line = line.replace(/=>\s*(.*)\s*$/, '{ return $1; }');
        // Remove the return type for now to simplify shorthand method
        line = line.replace(/(\))\s*:\s*[^=]+\s*=>/, '$1 =>');
        // Then apply the shorthand conversion
        line = line.replace(/^(\s*)async\s+(\w+)\s*\(([^)]*)\)\s*=>/, '$1async $2($3)');
    }
    // Fix: async name(params): Type => {
    else if (line.match(/^\s*async\s+\w+\s*\(.*\)\s*(?::\s*[^=]+)?\s*=>\s*\{/)) {
        line = line.replace(/(\))\s*:\s*[^=]+\s*=>\s*\{/, '$1 {');
        line = line.replace(/^(\s*)async\s+(\w+)\s*\(([^)]*)\)\s*\{/, '$1async $2($3) {');
    }
    // Fix: name: async (params): Type => expr
    else if (line.match(/^\s*\w+\s*:\s*async\s*\(.*\)\s*(?::\s*[^=]+)?\s*=>\s*[^\{]/)) {
        line = line.replace(/=>\s*(.*),\s*$/, '{ return $1; },');
        line = line.replace(/=>\s*(.*)\s*$/, '{ return $1; }');
        line = line.replace(/(\))\s*:\s*[^=]+\s*=>/, '$1 =>');
        line = line.replace(/^(\s*)(\w+)\s*:\s*async\s*\(([^)]*)\)\s*=>/, '$1async $2($3)');
    }
    // Fix: name: (params): Type => await expr
    else if (line.match(/^\s*\w+\s*:\s*\(.*\)\s*(?::\s*[^=]+)?\s*=>\s*await/)) {
        line = line.replace(/=>\s*(.*),\s*$/, '{ return $1; },');
        line = line.replace(/=>\s*(.*)\s*$/, '{ return $1; }');
        line = line.replace(/(\))\s*:\s*[^=]+\s*=>/, '$1 =>');
        line = line.replace(/^(\s*)(\w+)\s*:\s*\(([^)]*)\)\s*=>/, '$1async $2($3)');
    }
    
    lines[i] = line;
}

fs.writeFileSync(storagePath, lines.join('\n'));
console.log('Line-by-line normalized storage.ts with type handling.');
