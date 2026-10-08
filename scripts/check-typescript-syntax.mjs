import { readFileSync, readdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
let count = 0;
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (path.endsWith('.ts')) { stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }); count++; }
  }
}
walk('src');
console.log(`Parsed ${count} .ts files. Syntax only: no type checking, module resolution or TSX checks.`);
