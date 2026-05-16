const fs = require('fs');
const path = require('path');

const storagePath = path.join(__dirname, '../server/storage.ts');
let lines = fs.readFileSync(storagePath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Fix: async name(params) => expr
    // We match lines that start with async and have =>
    if (line.match(/^\s*async\s+\w+\s*\(.*\)\s*=>\s*[^\{]/)) {
        // Find the => and replace with { return and add } at the end before the comma
        line = line.replace(/=>\s*(.*),\s*$/, '{ return $1; },');
        line = line.replace(/=>\s*(.*)\s*$/, '{ return $1; }');
    }
    // Fix: async name(params) => {
    else if (line.match(/^\s*async\s+\w+\s*\(.*\)\s*=>\s*\{/)) {
        line = line.replace(/=>\s*\{/, '{');
    }
    // Fix: name: async (params) => expr
    else if (line.match(/^\s*\w+\s*:\s*async\s*\(.*\)\s*=>\s*[^\{]/)) {
        line = line.replace(/^(\s*)(\w+)\s*:\s*async\s*\(([^)]*)\)\s*=>\s*(.*),\s*$/, '$1async $2($3) { return $4; },');
        line = line.replace(/^(\s*)(\w+)\s*:\s*async\s*\(([^)]*)\)\s*=>\s*(.*)\s*$/, '$1async $2($3) { return $4; }');
    }
    // Fix: name: async (params) => {
    else if (line.match(/^\s*\w+\s*:\s*async\s*\(.*\)\s*=>\s*\{/)) {
        line = line.replace(/^(\s*)(\w+)\s*:\s*async\s*\(([^)]*)\)\s*=>\s*\{/, '$1async $2($3) {');
    }
    // Fix: name: (params) => await expr
    else if (line.match(/^\s*\w+\s*:\s*\(.*\)\s*=>\s*await/)) {
        line = line.replace(/^(\s*)(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*(await.*),\s*$/, '$1async $2($3) { return $4; },');
        line = line.replace(/^(\s*)(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*(await.*)\s*$/, '$1async $2($3) { return $4; }');
    }

    lines[i] = line;
}

fs.writeFileSync(storagePath, lines.join('\n'));
console.log('Line-by-line normalized storage.ts.');
