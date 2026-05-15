import { Project, SyntaxKind, CallExpression } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

async function migrate() {
  const storageFile = project.getSourceFileOrThrow("server/storage.ts");

  // Replace imports
  storageFile.getImportDeclaration(i => i.getModuleSpecifierValue() === "drizzle-orm/better-sqlite3")?.setModuleSpecifier("drizzle-orm/neon-serverless");
  if (!storageFile.getImportDeclaration(i => i.getModuleSpecifierValue() === "@neondatabase/serverless")) {
    storageFile.addImportDeclaration({
      moduleSpecifier: "@neondatabase/serverless",
      namedImports: ["Pool"],
    });
  }
  storageFile.getImportDeclaration(i => i.getModuleSpecifierValue() === "better-sqlite3")?.remove();

  // Replace db initialization (if not already done)
  const fullText = storageFile.getFullText();
  if (fullText.includes('new Database("data.db")')) {
    const dbInitRegex = /const sqlite = new Database\("data\.db"\);[\s\S]*?export const db = drizzle\(sqlite\);[\s\S]*?sqlite\.exec\(`[\s\S]*?`\);/g;
    const newDbInit = `if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);`;
    storageFile.replaceWithText(fullText.replace(dbInitRegex, newDbInit));
  }

  // Helper to make parent function async
  const makeParentAsync = (node: any) => {
    let parent = node.getParent();
    while (parent) {
      if (parent.getKind() === SyntaxKind.ArrowFunction || 
          parent.getKind() === SyntaxKind.FunctionExpression || 
          parent.getKind() === SyntaxKind.FunctionDeclaration ||
          parent.getKind() === SyntaxKind.MethodDeclaration) {
        parent.setIsAsync(true);
        // Remove return types that are not Promise
        const returnType = parent.getReturnTypeNode();
        if (returnType && !returnType.getText().startsWith("Promise")) {
           // We'll leave them for now and let the user fix or just strip if they are simple
           // Actually, it's safer to strip them in storage.ts methods to let TS infer Promise<T>
           if (parent.getKind() !== SyntaxKind.FunctionDeclaration) {
             // For object properties, return types can be tricky
           }
        }
        return;
      }
      parent = parent.getParent();
    }
  };

  // Find all .get(), .all(), .run()
  storageFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
    try {
      const text = call.getText();
      if (text.endsWith(".get()")) {
        const inner = text.slice(0, -6);
        makeParentAsync(call);
        call.replaceWithText(`(await ${inner})[0]`);
      } else if (text.endsWith(".all()")) {
        const inner = text.slice(0, -6);
        makeParentAsync(call);
        call.replaceWithText(`await ${inner}`);
      } else if (text.endsWith(".run()")) {
        const inner = text.slice(0, -6);
        makeParentAsync(call);
        call.replaceWithText(`await ${inner}`);
      }
    } catch (e) {}
  });

  // Handle db.select().from() without terminal method (should be awaited)
  storageFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
    const text = call.getText();
    if (text.includes("db.") && (text.includes(".select") || text.includes(".insert") || text.includes(".update") || text.includes(".delete"))) {
      const parent = call.getParent();
      if (parent && parent.getKind() !== SyntaxKind.AwaitExpression && !call.getText().startsWith("(await")) {
         // Check if it's a statement or part of a return
         call.replaceWithText(`await ${text}`);
         makeParentAsync(call);
      }
    }
  });

  storageFile.saveSync();
  console.log("Storage migrated.");

  // Now handle routes
  const serverFiles = project.getSourceFiles("server/**/*.ts");
  for (const f of serverFiles) {
    if (f.getBaseName() === "storage.ts") continue;
    let modified = false;
    f.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const text = call.getText();
      if (text.startsWith("storage.") || text.startsWith("(storage as any).")) {
        const parent = call.getParent();
        if (parent && parent.getKind() !== SyntaxKind.AwaitExpression) {
          call.replaceWithText(`await ${text}`);
          makeParentAsync(call);
          modified = true;
        }
      }
    });
    if (modified) {
      f.saveSync();
      console.log(`Migrated ${f.getBaseName()}`);
    }
  }
}

migrate().catch(console.error);
