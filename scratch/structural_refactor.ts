import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment, MethodDeclaration, ArrowFunction } from "ts-morph";
import * as fs from 'fs';

const project = new Project();
const sourceFile = project.addSourceFileAtPath("server/storage.ts");

// 1. Find all ObjectLiteralExpressions
sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).forEach(obj => {
    obj.getProperties().forEach(prop => {
        const propText = prop.getText();

        // If it matches the "broken shorthand" pattern: async name(params) => expr
        // or name: async (params) => expr

        if (prop.getKind() === SyntaxKind.PropertyAssignment) {
            const pa = prop as PropertyAssignment;
            const name = pa.getName();
            const init = pa.getInitializer();
            if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
                const func = init as any;
                const params = func.getParameters().map((p: any) => p.getText()).join(", ");
                const body = func.getBody();
                const bodyText = body.getKind() === SyntaxKind.Block ? body.getText() : `{ return ${body.getText()}; }`;
                const isAsync = propText.includes("async") || bodyText.includes("await");
                pa.replaceWithText(`${isAsync ? "async " : ""}${name}(${params}) ${bodyText}`);
            }
        } else if (prop.getKind() === SyntaxKind.MethodDeclaration) {
            // Check if it has a fat arrow in its text before the body starts
            // This is how we find the "broken shorthand"
            if (propText.includes("=>")) {
                const md = prop as MethodDeclaration;
                const name = md.getName();
                const params = md.getParameters().map(p => p.getText()).join(", ");
                // The body might be an ArrowFunction if it was parsed weirdly
                const body = md.getBody();
                if (body) {
                    const bodyText = body.getKind() === SyntaxKind.Block ? body.getText() : `{ return ${body.getText()}; }`;
                    const isAsync = md.isAsync();
                    md.replaceWithText(`${isAsync ? "async " : ""}${name}(${params}) ${bodyText}`);
                }
            }
        }
    });
});

// Also fix routes and seed while we are at it
const otherFiles = ["server/routes.ts", "server/seed.ts"];
otherFiles.forEach(path => {
    const sf = project.addSourceFileAtPath(path);
    sf.getDescendantsOfKind(SyntaxKind.ArrowFunction).forEach(f => {
        if (f.getText().includes("await") && !f.isAsync()) f.setIsAsync(true);
    });
    sf.getDescendantsOfKind(SyntaxKind.FunctionExpression).forEach(f => {
        if (f.getText().includes("await") && !f.isAsync()) f.setIsAsync(true);
    });
    sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(f => {
        if (f.getText().includes("await") && !f.isAsync()) f.setIsAsync(true);
    });
    sf.saveSync();
});

sourceFile.saveSync();
console.log("Completed structural refactor with ts-morph.");
