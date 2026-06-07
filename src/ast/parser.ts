import ts from 'typescript';

export interface CodeBlock {
    name: string;
    kind: string;
    startLine: number;
    endLine: number;
    complexity: number;
    content: string;
}

export class ASTParser {
    /**
     * Parses a source file and extracts high-level code blocks with complexity scores.
     */
    static parseFile(fileName: string, sourceText: string): CodeBlock[] {
        const sourceFile = ts.createSourceFile(
            fileName,
            sourceText,
            ts.ScriptTarget.Latest,
            true
        );

        const blocks: CodeBlock[] = [];

        function visit(node: ts.Node) {
            // We want to extract functions, classes, and methods
            if (
                ts.isFunctionDeclaration(node) ||
                ts.isMethodDeclaration(node) ||
                ts.isArrowFunction(node) ||
                ts.isFunctionExpression(node) ||
                ts.isClassDeclaration(node)
            ) {
                let name = 'anonymous';
                if (ts.isClassDeclaration(node) && node.name) {
                    name = node.name.text;
                } else if (ts.isFunctionDeclaration(node) && node.name) {
                    name = node.name.text;
                } else if (ts.isMethodDeclaration(node) && node.name) {
                    name = node.name.getText(sourceFile);
                } else if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
                    name = node.parent.name.text;
                }

                const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
                const content = node.getText(sourceFile);
                const complexity = ASTParser.calculateComplexity(node);

                blocks.push({
                    name,
                    kind: ts.SyntaxKind[node.kind],
                    startLine,
                    endLine,
                    complexity,
                    content
                });
            }

            ts.forEachChild(node, visit);
        }

        visit(sourceFile);
        return blocks;
    }

    /**
     * Calculates McCabe's Cyclomatic Complexity for a given AST node.
     */
    static calculateComplexity(node: ts.Node): number {
        let complexity = 1;

        function visit(n: ts.Node) {
            switch (n.kind) {
                case ts.SyntaxKind.IfStatement:
                case ts.SyntaxKind.CatchClause:
                case ts.SyntaxKind.ConditionalExpression:
                case ts.SyntaxKind.ForStatement:
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                case ts.SyntaxKind.WhileStatement:
                case ts.SyntaxKind.DoStatement:
                case ts.SyntaxKind.AmpersandAmpersandToken:
                case ts.SyntaxKind.BarBarToken:
                case ts.SyntaxKind.QuestionQuestionToken: // Nullish coalescing
                    complexity++;
                    break;
                case ts.SyntaxKind.CaseClause:
                    // Only count cases, not the default clause
                    complexity++;
                    break;
            }
            ts.forEachChild(n, visit);
        }

        ts.forEachChild(node, visit);
        return complexity;
    }
}
