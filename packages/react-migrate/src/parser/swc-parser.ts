import { parseSync, type Module } from '@swc/core';
import type { ParseOptions, ParseResult, ParseError } from './types.js';

/**
 * 파일 확장자에서 파싱 옵션 추론
 */
function inferParseOptions(filePath: string): ParseOptions {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'tsx':
      return { syntax: 'typescript', tsx: true, jsx: true, decorators: true };
    case 'ts':
      return { syntax: 'typescript', tsx: false, jsx: false, decorators: true };
    case 'jsx':
      return { syntax: 'ecmascript', tsx: false, jsx: true, decorators: false };
    case 'js':
    case 'mjs':
    case 'cjs':
      return { syntax: 'ecmascript', tsx: false, jsx: false, decorators: false };
    default:
      // 기본값: TypeScript + JSX
      return { syntax: 'typescript', tsx: true, jsx: true, decorators: true };
  }
}

/**
 * SWC 에러에서 파싱 에러 추출
 */
function extractParseError(error: unknown): ParseError {
  if (error instanceof Error) {
    // SWC 에러 메시지 파싱 시도
    const message = error.message;
    const lineMatch = message.match(/at line (\d+)/i);
    const columnMatch = message.match(/column (\d+)/i);

    return {
      message: message,
      line: lineMatch ? parseInt(lineMatch[1] ?? '1', 10) : 1,
      column: columnMatch ? parseInt(columnMatch[1] ?? '0', 10) : 0,
    };
  }

  return {
    message: String(error),
    line: 1,
    column: 0,
  };
}

/**
 * 단일 파일 파싱
 */
export function parseFile(
  content: string,
  filePath: string,
  options?: Partial<ParseOptions>
): ParseResult {
  const startTime = performance.now();
  const inferredOptions = inferParseOptions(filePath);
  const parserOptions: ParseOptions = { ...inferredOptions, ...options };

  try {
    const ast = parseSync(content, {
      syntax: parserOptions.syntax,
      tsx: parserOptions.tsx,
      jsx: parserOptions.jsx,
      decorators: parserOptions.decorators,
      dynamicImport: true,
    });

    return {
      success: true,
      ast,
      errors: [],
      filePath,
      parseTime: performance.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      ast: null,
      errors: [extractParseError(error)],
      filePath,
      parseTime: performance.now() - startTime,
    };
  }
}

/**
 * 여러 파일 배치 파싱
 */
export async function parseBatch(
  files: Array<{ path: string; content: string }>,
  options?: Partial<ParseOptions>
): Promise<ParseResult[]> {
  return files.map(({ path, content }) => parseFile(content, path, options));
}

/**
 * AST가 유효한지 확인
 */
export function isValidAST(ast: Module | null): ast is Module {
  return ast !== null && ast.type === 'Module' && Array.isArray(ast.body);
}

/**
 * AST에서 특정 노드 타입 찾기 (간단한 방문자)
 */
export function findNodes<T>(
  ast: Module,
  predicate: (node: unknown) => node is T
): T[] {
  const results: T[] = [];

  function visit(node: unknown): void {
    if (node === null || node === undefined) return;

    if (predicate(node)) {
      results.push(node);
    }

    if (typeof node === 'object') {
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          value.forEach(visit);
        } else if (typeof value === 'object') {
          visit(value);
        }
      }
    }
  }

  visit(ast);
  return results;
}

/**
 * AST 노드의 소스 위치 추출
 */
export function getNodeLocation(node: { span?: { start: number; end: number } }): {
  start: number;
  end: number;
} | null {
  if (node.span) {
    return {
      start: node.span.start,
      end: node.span.end,
    };
  }
  return null;
}

/**
 * AST에서 import 정보 추출
 */
export function extractImports(ast: Module): Array<{
  source: string;
  specifiers: Array<{
    name: string;
    alias?: string;
    isDefault: boolean;
    isNamespace: boolean;
  }>;
  isTypeOnly: boolean;
}> {
  const imports: Array<{
    source: string;
    specifiers: Array<{
      name: string;
      alias?: string;
      isDefault: boolean;
      isNamespace: boolean;
    }>;
    isTypeOnly: boolean;
  }> = [];

  for (const item of ast.body) {
    if (item.type === 'ImportDeclaration') {
      const specifiers: Array<{
        name: string;
        alias?: string;
        isDefault: boolean;
        isNamespace: boolean;
      }> = [];

      for (const spec of item.specifiers) {
        if (spec.type === 'ImportDefaultSpecifier') {
          specifiers.push({
            name: spec.local.value,
            isDefault: true,
            isNamespace: false,
          });
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          specifiers.push({
            name: spec.local.value,
            isDefault: false,
            isNamespace: true,
          });
        } else if (spec.type === 'ImportSpecifier') {
          const imported = spec.imported;
          const importedName = imported?.type === 'Identifier' ? imported.value : spec.local.value;
          specifiers.push({
            name: importedName,
            alias: importedName !== spec.local.value ? spec.local.value : undefined,
            isDefault: false,
            isNamespace: false,
          });
        }
      }

      imports.push({
        source: item.source.value,
        specifiers,
        isTypeOnly: item.typeOnly ?? false,
      });
    }
  }

  return imports;
}

/**
 * AST에서 export 정보 추출
 */
export function extractExports(ast: Module): Array<{
  name: string;
  isDefault: boolean;
  isTypeOnly: boolean;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'unknown';
}> {
  const exports: Array<{
    name: string;
    isDefault: boolean;
    isTypeOnly: boolean;
    type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'unknown';
  }> = [];

  for (const item of ast.body) {
    // export default ...
    if (item.type === 'ExportDefaultDeclaration') {
      const decl = item.decl as { type: string; identifier?: { value: string }; value?: string };
      let name = 'default';
      let type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'unknown' = 'unknown';

      if (decl.type === 'FunctionExpression' || decl.type === 'ArrowFunctionExpression') {
        type = 'function';
        if (decl.type === 'FunctionExpression' && decl.identifier) {
          name = decl.identifier.value;
        }
      } else if (decl.type === 'ClassExpression') {
        type = 'class';
        if (decl.identifier) {
          name = decl.identifier.value;
        }
      } else if (decl.type === 'Identifier' && decl.value) {
        name = decl.value;
      }

      exports.push({ name, isDefault: true, isTypeOnly: false, type });
    }

    // export function/class/const ...
    if (item.type === 'ExportDeclaration') {
      const decl = item.declaration;

      if (decl.type === 'FunctionDeclaration') {
        exports.push({
          name: decl.identifier.value,
          isDefault: false,
          isTypeOnly: false,
          type: 'function',
        });
      } else if (decl.type === 'ClassDeclaration') {
        exports.push({
          name: decl.identifier.value,
          isDefault: false,
          isTypeOnly: false,
          type: 'class',
        });
      } else if (decl.type === 'VariableDeclaration') {
        for (const declarator of decl.declarations) {
          if (declarator.id.type === 'Identifier') {
            exports.push({
              name: declarator.id.value,
              isDefault: false,
              isTypeOnly: false,
              type: 'variable',
            });
          }
        }
      } else if (decl.type === 'TsInterfaceDeclaration') {
        exports.push({
          name: decl.id.value,
          isDefault: false,
          isTypeOnly: true,
          type: 'interface',
        });
      } else if (decl.type === 'TsTypeAliasDeclaration') {
        exports.push({
          name: decl.id.value,
          isDefault: false,
          isTypeOnly: true,
          type: 'type',
        });
      }
    }

    // export { ... } from '...'
    if (item.type === 'ExportNamedDeclaration') {
      for (const spec of item.specifiers) {
        if (spec.type === 'ExportSpecifier') {
          const orig = spec.orig;
          const exported = spec.exported;
          const name = exported?.type === 'Identifier' ? exported.value : orig.value;
          exports.push({
            name,
            isDefault: false,
            isTypeOnly: item.typeOnly ?? false,
            type: 'unknown',
          });
        }
      }
    }
  }

  return exports;
}

export type { Module };
