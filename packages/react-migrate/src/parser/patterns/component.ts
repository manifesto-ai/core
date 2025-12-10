import type { Module, FunctionDeclaration, VariableDeclaration, ExportDeclaration, ExportDefaultDeclaration } from '@swc/core';
import type { DetectedPattern, PatternDetector, SourceLocation } from '../types.js';
import { findNodes } from '../swc-parser.js';

/**
 * React 컴포넌트 패턴 감지기
 */
export class ComponentPatternDetector implements PatternDetector {
  readonly type = 'component' as const;

  detect(ast: Module, _filePath: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // 1. Function declarations (export function MyComponent() { ... })
    const functionDecls = this.findFunctionComponents(ast);
    patterns.push(...functionDecls);

    // 2. Arrow function components (const MyComponent = () => { ... })
    const arrowComponents = this.findArrowFunctionComponents(ast);
    patterns.push(...arrowComponents);

    // 3. forwardRef components
    const forwardRefComponents = this.findForwardRefComponents(ast);
    patterns.push(...forwardRefComponents);

    // 4. memo components
    const memoComponents = this.findMemoComponents(ast);
    patterns.push(...memoComponents);

    return patterns;
  }

  private findFunctionComponents(ast: Module): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const item of ast.body) {
      // export function Component() { ... }
      if (item.type === 'ExportDeclaration') {
        const decl = (item as ExportDeclaration).declaration;
        if (decl && decl.type === 'FunctionDeclaration') {
          const funcDecl = decl as FunctionDeclaration;
          if (this.isPascalCase(funcDecl.identifier.value)) {
            const pattern = this.createComponentPattern(
              funcDecl.identifier.value,
              this.spanToLocation(funcDecl.span),
              this.extractPropsFromFunction(funcDecl),
              this.extractHooksFromFunction(funcDecl)
            );
            patterns.push(pattern);
          }
        }
      }

      // function Component() { ... } (not exported inline)
      if (item.type === 'FunctionDeclaration') {
        const funcDecl = item as FunctionDeclaration;
        if (this.isPascalCase(funcDecl.identifier.value)) {
          const pattern = this.createComponentPattern(
            funcDecl.identifier.value,
            this.spanToLocation(funcDecl.span),
            this.extractPropsFromFunction(funcDecl),
            this.extractHooksFromFunction(funcDecl)
          );
          patterns.push(pattern);
        }
      }

      // export default function Component() { ... }
      if (item.type === 'ExportDefaultDeclaration') {
        const defaultDecl = item as ExportDefaultDeclaration;
        if (defaultDecl.decl.type === 'FunctionExpression') {
          const funcExpr = defaultDecl.decl;
          const name = funcExpr.identifier?.value ?? 'DefaultComponent';
          if (this.isPascalCase(name)) {
            const pattern = this.createComponentPattern(
              name,
              this.spanToLocation(defaultDecl.span),
              [],
              []
            );
            patterns.push(pattern);
          }
        }
      }
    }

    return patterns;
  }

  private findArrowFunctionComponents(ast: Module): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const item of ast.body) {
      // const Component = () => { ... }
      // export const Component = () => { ... }
      let varDecl: VariableDeclaration | null = null;

      if (item.type === 'VariableDeclaration') {
        varDecl = item as VariableDeclaration;
      } else if (item.type === 'ExportDeclaration') {
        const exportDecl = item as ExportDeclaration;
        if (exportDecl.declaration?.type === 'VariableDeclaration') {
          varDecl = exportDecl.declaration as VariableDeclaration;
        }
      }

      if (varDecl) {
        for (const decl of varDecl.declarations) {
          if (
            decl.id.type === 'Identifier' &&
            this.isPascalCase(decl.id.value) &&
            decl.init
          ) {
            // Arrow function 또는 function expression
            if (
              decl.init.type === 'ArrowFunctionExpression' ||
              decl.init.type === 'FunctionExpression'
            ) {
              const pattern = this.createComponentPattern(
                decl.id.value,
                this.spanToLocation(decl.span),
                [],
                []
              );
              patterns.push(pattern);
            }
          }
        }
      }
    }

    return patterns;
  }

  private findForwardRefComponents(ast: Module): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // forwardRef 호출 찾기
    const callExprs = findNodes(ast, (node): node is { type: 'CallExpression'; callee: unknown; arguments: unknown[]; span: { start: number; end: number } } =>
      typeof node === 'object' &&
      node !== null &&
      'type' in node &&
      node.type === 'CallExpression'
    );

    for (const call of callExprs) {
      if (this.isForwardRefCall(call.callee)) {
        // forwardRef로 감싸진 컴포넌트 찾기
        const name = this.findComponentNameFromForwardRef(ast, call);
        if (name) {
          const pattern = this.createComponentPattern(
            name,
            this.spanToLocation(call.span),
            [],
            [],
            { isForwardRef: true }
          );
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  private findMemoComponents(ast: Module): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // React.memo 또는 memo 호출 찾기
    const callExprs = findNodes(ast, (node): node is { type: 'CallExpression'; callee: unknown; arguments: unknown[]; span: { start: number; end: number } } =>
      typeof node === 'object' &&
      node !== null &&
      'type' in node &&
      node.type === 'CallExpression'
    );

    for (const call of callExprs) {
      if (this.isMemoCall(call.callee)) {
        const name = this.findComponentNameFromMemo(ast, call);
        if (name) {
          const pattern = this.createComponentPattern(
            name,
            this.spanToLocation(call.span),
            [],
            [],
            { isMemo: true }
          );
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  private isPascalCase(name: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
  }

  private spanToLocation(span: { start: number; end: number }): SourceLocation {
    // SWC span은 byte offset이므로 대략적인 위치만 제공
    return {
      start: { line: 1, column: span.start },
      end: { line: 1, column: span.end },
    };
  }

  private createComponentPattern(
    name: string,
    location: SourceLocation,
    props: string[],
    hooks: string[],
    extra: { isForwardRef?: boolean; isMemo?: boolean } = {}
  ): DetectedPattern {
    return {
      type: 'component',
      name,
      location,
      confidence: 0.9,
      metadata: {
        props,
        hooks,
        isForwardRef: extra.isForwardRef ?? false,
        isMemo: extra.isMemo ?? false,
      },
      needsReview: false,
    };
  }

  private extractPropsFromFunction(_funcDecl: FunctionDeclaration): string[] {
    // 간단한 구현 - 향후 확장 가능
    return [];
  }

  private extractHooksFromFunction(_funcDecl: FunctionDeclaration): string[] {
    // 간단한 구현 - 향후 확장 가능
    return [];
  }

  private isForwardRefCall(callee: unknown): boolean {
    if (typeof callee !== 'object' || callee === null) return false;

    // React.forwardRef
    if ('type' in callee && callee.type === 'MemberExpression') {
      const member = callee as { object?: { value?: string }; property?: { value?: string } };
      return member.object?.value === 'React' && member.property?.value === 'forwardRef';
    }

    // forwardRef (직접 import)
    if ('type' in callee && callee.type === 'Identifier') {
      const ident = callee as { value?: string };
      return ident.value === 'forwardRef';
    }

    return false;
  }

  private isMemoCall(callee: unknown): boolean {
    if (typeof callee !== 'object' || callee === null) return false;

    // React.memo
    if ('type' in callee && callee.type === 'MemberExpression') {
      const member = callee as { object?: { value?: string }; property?: { value?: string } };
      return member.object?.value === 'React' && member.property?.value === 'memo';
    }

    // memo (직접 import)
    if ('type' in callee && callee.type === 'Identifier') {
      const ident = callee as { value?: string };
      return ident.value === 'memo';
    }

    return false;
  }

  private findComponentNameFromForwardRef(_ast: Module, _call: unknown): string | null {
    // 간단한 구현 - 변수 이름에서 추출
    return 'ForwardRefComponent';
  }

  private findComponentNameFromMemo(_ast: Module, _call: unknown): string | null {
    // 간단한 구현 - 변수 이름에서 추출
    return 'MemoComponent';
  }
}

export const componentDetector = new ComponentPatternDetector();
