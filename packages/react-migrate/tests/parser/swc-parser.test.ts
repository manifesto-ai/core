import { describe, it, expect } from 'vitest';
import { parseFile, isValidAST } from '../../src/parser/swc-parser.js';

describe('SWC Parser', () => {
  describe('parseFile', () => {
    it('should parse valid TypeScript file', () => {
      const content = `
        export function hello(): string {
          return 'world';
        }
      `;

      const result = parseFile(content, 'test.ts');

      expect(result.success).toBe(true);
      expect(result.ast).not.toBeNull();
      expect(result.errors).toHaveLength(0);
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should parse TSX file with JSX', () => {
      const content = `
        import React from 'react';

        export function Button() {
          return <button>Click me</button>;
        }
      `;

      const result = parseFile(content, 'Button.tsx');

      expect(result.success).toBe(true);
      expect(result.ast).not.toBeNull();
    });

    it('should handle parse errors gracefully', () => {
      const content = `
        export function broken( {
          return 'missing closing paren';
        }
      `;

      const result = parseFile(content, 'broken.ts');

      expect(result.success).toBe(false);
      expect(result.ast).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should infer correct options from file extension', () => {
      const tsContent = 'const x: number = 1;';
      const jsContent = 'const x = 1;';

      const tsResult = parseFile(tsContent, 'file.ts');
      const jsResult = parseFile(jsContent, 'file.js');

      expect(tsResult.success).toBe(true);
      expect(jsResult.success).toBe(true);
    });
  });

  describe('isValidAST', () => {
    it('should return true for valid AST', () => {
      const result = parseFile('const x = 1;', 'test.ts');
      expect(isValidAST(result.ast)).toBe(true);
    });

    it('should return false for null AST', () => {
      expect(isValidAST(null)).toBe(false);
    });
  });
});
