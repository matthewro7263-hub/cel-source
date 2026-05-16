import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment, MethodDeclaration } from "ts-morph";

const project = new Project();
const sourceFile = project.addSourceFileAtPath("server/storage.ts");

// 1. Find all ObjectLiteralExpressions
const objects = sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);

objects.forEach(obj => {
    if (!obj.wasForgotten()) {
        const props = obj.getProperties();
        props.forEach(prop => {
            if (prop.wasForgotten()) return;

            const propText = prop.getText();

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
                const md = prop as MethodDeclaration;
                const body = md.getBody();
                if (body && body.getText().includes("await") && !md.isAsync()) {
                    md.setIsAsync(true);
                }
            }
        });
    }
});

// Also fix routes and seed
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
