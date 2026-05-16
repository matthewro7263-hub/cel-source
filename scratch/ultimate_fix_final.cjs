const fs = require('fs');
const glob = require('glob');
const schemaFiles = glob.sync('shared/*schema.ts');
schemaFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ [^}]* \} from "drizzle-orm\/pg-core";/g, 'import { pgTable, text, timestamp, integer, serial, boolean, uuid, bigint, index } from "drizzle-orm/pg-core";');
  fs.writeFileSync(file, content);
});
const routeFiles = glob.sync('server/*.ts');
routeFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/app\.(get|post|put|delete)\("([^"]+)",\s*([^,]+),\s*\((req|res),\s*(res|req)\)\s*=>/g, 'app.$1("$2", $3, async ($4, $5) =>');
  content = content.replace(/app\.(get|post|put|delete)\("([^"]+)",\s*\((req|res),\s*(res|req)\)\s*=>/g, 'app.$1("$2", async ($3, $4) =>');
  content = content.replace(/(?<!await )storage\./g, 'await storage.');
  content = content.replace(/(?<!await )\(storage as any\)\./g, 'await (storage as any).');
  content = content.replace(/function requireAuth\(req: Request, res: Response, next: NextFunction\) \{/g, 'async function requireAuth(req: Request, res: Response, next: NextFunction) {');
  content = content.replace(/function canAccessProject\(projectId: number, userId: number\): boolean \{/g, 'async function canAccessProject(projectId: number, userId: number): Promise<boolean> {');
  content = content.replace(/await await/g, 'await');
  fs.writeFileSync(file, content);
});
const storageContent = fs.readFileSync('server/storage.ts', 'utf8');
const fixedStorage = storageContent.replace(/export type \{([^}]*)\} from "([^"]*)";/g, 'import type {$1} from "$2";\nexport type {$1};');
fs.writeFileSync('server/storage.ts', fixedStorage);
console.log('Final fix applied.');
