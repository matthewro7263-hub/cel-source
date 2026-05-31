import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment, ArrowFunction, FunctionExpression, ParameterDeclaration } from "ts-morph";
import * as fs from 'fs';

const project = new Project();
const sourceFile = project.addSourceFileAtPath("server/storage.ts");

const storageVar = sourceFile.getVariableDeclaration("storage");
const obj = storageVar!.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);

const props = obj!.getProperties();
const methods: string[] = [];

props.forEach(prop => {
    if (prop.getKind() === SyntaxKind.PropertyAssignment) {
        const pa = prop as PropertyAssignment;
        const name = pa.getName();
        const initializer = pa.getInitializer();

        if (initializer && (initializer.getKind() === SyntaxKind.ArrowFunction || initializer.getKind() === SyntaxKind.FunctionExpression)) {
            const func = initializer as ArrowFunction | FunctionExpression;
            const params = func.getParameters().map((p: ParameterDeclaration) => p.getText()).join(", ");
            const body = func.getBody();
            const bodyText = body.getKind() === SyntaxKind.Block ? body.getText() : `{ return ${body.getText()}; }`;
            
            // Extract return type if present
            let returnType = "";
            const typeNode = func.getReturnTypeNode();
            if (typeNode) {
                const t = typeNode.getText();
                returnType = t.startsWith("Promise<") ? `: ${t}` : `: Promise<${t}>`;
            }

            methods.push(`  async ${name}(${params})${returnType} ${bodyText}`);
        }
    } else if (prop.getKind() === SyntaxKind.MethodDeclaration) {
        methods.push(prop.getText());
    }
});

const newStorageObject = `export const storage = {\n${methods.join(",\n")}\n};`;

// Find the start and end of the storage variable
const start = storageVar!.getStart();
const end = obj!.getEnd();

// We need to replace from the start of the variable to the end of the object
// But wait, there is extra stuff after.
// Let's just replace the object part.

obj!.replaceWithText(`{\n${methods.join(",\n")}\n}`);

// Also fix types at the top
const content = sourceFile.getText();
const fixedContent = content.replace(/export type \{([^}]*)\} from "([^"]*)";/g, 'import type {$1} from "$2";\nexport type {$1};');

fs.writeFileSync("server/storage.ts", fixedContent);
console.log("Storage layer successfully reconstructed.");
