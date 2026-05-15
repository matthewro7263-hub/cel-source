import { Project, SyntaxKind, PropertyAssignment } from "ts-morph";
const project = new Project();
const sourceFile = project.addSourceFileAtPath("server/storage.ts");
const storageVar = sourceFile.getVariableDeclarationOrThrow("storage");
const obj = storageVar.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
obj.getProperties().forEach(prop => {
    if (prop.getKind() === SyntaxKind.PropertyAssignment) {
        const pa = prop as PropertyAssignment;
        const name = pa.getName();
        const initializer = pa.getInitializer();
        if (initializer && (initializer.getKind() === SyntaxKind.ArrowFunction || initializer.getKind() === SyntaxKind.FunctionExpression)) {
            const func = initializer as any;
            const params = func.getParameters().map(p => p.getText()).join(", ");
            const body = func.getBody();
            const bodyText = body.getKind() === SyntaxKind.Block ? body.getText() : `{ return ${body.getText()}; }`;
            pa.replaceWithText(`async ${name}(${params}) ${bodyText}`);
        }
    }
});
sourceFile.saveSync();
