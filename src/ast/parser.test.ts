import { describe, it, expect } from 'vitest';
import { ASTParser } from './parser.js';

describe('ASTParser', () => {
    it('should extract functions and their complexity', () => {
        const sourceCode = `
            function simpleFunction() {
                return true;
            }

            class MyClass {
                complexMethod(x: number) {
                    if (x > 10) {
                        return x * 2;
                    } else if (x < 0) {
                        for (let i = 0; i < 5; i++) {
                            console.log(i);
                        }
                    }
                    return x;
                }
            }

            const arrowFunc = (y) => {
                return y ? true : false;
            }
        `;

        const blocks = ASTParser.parseFile('test.ts', sourceCode);
        
        expect(blocks).toHaveLength(4); // simpleFunction, MyClass, complexMethod, arrowFunc

        const simpleFuncBlock = blocks.find((b: any) => b.name === 'simpleFunction');
        expect(simpleFuncBlock).toBeDefined();
        expect(simpleFuncBlock?.complexity).toBe(1);

        const complexMethodBlock = blocks.find((b: any) => b.name === 'complexMethod');
        expect(complexMethodBlock).toBeDefined();
        // Base(1) + if(1) + else if(1) + for(1) = 4
        expect(complexMethodBlock?.complexity).toBe(4);

        const arrowBlock = blocks.find((b: any) => b.name === 'arrowFunc');
        expect(arrowBlock).toBeDefined();
        // Base(1) + ternary(1) = 2
        expect(arrowBlock?.complexity).toBe(2);
    });
});
