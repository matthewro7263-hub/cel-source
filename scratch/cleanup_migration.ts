import { Project, SyntaxKind, CallExpression, FunctionDeclaration, ArrowFunction, FunctionExpression, MethodDeclaration } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

function makeParentAsync(node: any) {
  let parent = node.getParent();
  while (parent) {
    if (parent.getKind() === SyntaxKind.ArrowFunction || 
        parent.getKind() === SyntaxKind.FunctionExpression || 
        parent.getKind() === SyntaxKind.FunctionDeclaration ||
        parent.getKind() === SyntaxKind.MethodDeclaration) {
      const func = parent as any;
      func.setIsAsync(true);
      
      // Remove explicit return types if they are not Promise
      const typeNode = func.getReturnTypeNode();
      if (typeNode && !typeNode.getText().startsWith("Promise")) {
          // If it's a simple type like boolean or User, we should wrap it or remove it
          const typeText = typeNode.getText();
          if (typeText === "boolean" || typeText === "string" || typeText === "number") {
             func.setReturnType(`Promise<${typeText}>`);
          } else {
             // For complex types, it's often easier to just remove and let TS infer
             typeNode.replaceWithText(`Promise<any>`); 
          }
      }
      return;
    }
    parent = parent.getParent();
  }
}

async function run() {
  const sourceFiles = project.getSourceFiles("server/**/*.ts");
  
  for (const f of sourceFiles) {
    let modified = false;
    
    // Process all calls to storage in reverse order
    const storageCalls = f.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => {
        const text = call.getText();
        return text.startsWith("storage.") || text.startsWith("(storage as any).") || text.includes(".storage.");
      });

    for (let i = storageCalls.length - 1; i >= 0; i--) {
      const call = storageCalls[i];
      const text = call.getText();
      const parent = call.getParent();
      if (parent && parent.getKind() !== SyntaxKind.AwaitExpression) {
        makeParentAsync(call);
        call.replaceWithText(`await ${text}`);
        modified = true;
      }
    }

    // Also process canAccessProject and other local helpers in reverse order
    const asyncHelpers = ["canAccessProject", "requireAuth"];
    const helperCalls = f.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => asyncHelpers.includes(call.getExpression().getText()));

    for (let i = helperCalls.length - 1; i >= 0; i--) {
      const call = helperCalls[i];
      const parent = call.getParent();
      if (parent && parent.getKind() !== SyntaxKind.AwaitExpression) {
        makeParentAsync(call);
        call.replaceWithText(`await ${call.getText()}`);
        modified = true;
      }
    }

    if (modified) {
      f.saveSync();
      console.log(`Updated ${f.getBaseName()}`);
    }
  }
}

run().catch(console.error);
