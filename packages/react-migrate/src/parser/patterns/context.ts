import type { Module, VariableDeclaration, ExportDeclaration } from '@swc/core';
import type { DetectedPattern, PatternDetector, SourceLocation } from '../types.js';
import { findNodes } from '../swc-parser.js';

/**
 * React Context 패턴 감지기
 */
export class ContextPatternDetector implements PatternDetector {
  readonly type = 'context' as const;

  detect(ast: Module, _filePath: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // 1. createContext 호출 찾기
    const contextCreations = this.findContextCreations(ast);
    patterns.push(...contextCreations);

    // 2. Context Provider 패턴 찾기
    const providerPatterns = this.findProviderPatterns(ast);
    patterns.push(...providerPatterns);

    // 3. useContext 호출 찾기
    const contextUsages = this.findContextUsages(ast);
    patterns.push(...contextUsages);

    return patterns;
  }

  private findContextCreations(ast: Module): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // createContext 호출 찾기
    const callExprs = findNodes(ast, (node): node is {
      type: 'CallExpression';
      callee: unknown;
      arguments: unknown[];
      span: { start: number; end: number };
    } =>
      typeof node === 'object' &&
      node !== null &&
      'type' in node &&
      node.type === 'CallExpression'
    );

    for (const call of callExprs) {
      if (this.isCreateContextCall(call.callee)) {
        const contextName = this.findContextName(ast, call);
        patterns.push(this.createContextPattern(
          contextName ?? 'UnnamedContext',
          this.spanToLocation(call.span),
          { hasProvider: false, hasConsumer: false }
        ));
      }
    }

    return patterns;
  }

  private findProviderPatterns(ast: Module): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Provider 컴포넌트 찾기 (보통 xxxProvider 형태)
    for (const item of ast.body) {
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
            decl.id.value.endsWith('Provider') &&
            decl.init &&
            (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')
          ) {
            patterns.push(this.createContextPattern(
              decl.id.value,
              this.spanToLocation(decl.span),
              { hasProvider: true, hasConsumer: false }
            ));
          }
        }
      }
    }

    return patterns;
  }

  private findContextUsages(ast: Module): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // useContext 호출 찾기
    const callExprs = findNodes(ast, (node): node is {
      type: 'CallExpression';
      callee: unknown;
      arguments: unknown[];
      span: { start: number; end: number };
    } =>
      typeof node === 'object' &&
      node !== null &&
      'type' in node &&
      node.type === 'CallExpression'
    );

    for (const call of callExprs) {
      if (this.isUseContextCall(call.callee)) {
        const contextName = this.extractContextFromUseContext(call.arguments);
        if (contextName) {
          patterns.push({
            type: 'context',
            name: `useContext(${contextName})`,
            location: this.spanToLocation(call.span),
            confidence: 1.0,
            metadata: {
              contextName,
              hasConsumer: true,
            },
            needsReview: false,
          });
        }
      }
    }

    return patterns;
  }

  private isCreateContextCall(callee: unknown): boolean {
    if (typeof callee !== 'object' || callee === null) return false;

    // React.createContext
    if ('type' in callee && callee.type === 'MemberExpression') {
      const member = callee as { object?: { value?: string }; property?: { value?: string } };
      return member.object?.value === 'React' && member.property?.value === 'createContext';
    }

    // createContext (직접 import)
    if ('type' in callee && callee.type === 'Identifier') {
      const ident = callee as { value?: string };
      return ident.value === 'createContext';
    }

    return false;
  }

  private isUseContextCall(callee: unknown): boolean {
    if (typeof callee !== 'object' || callee === null) return false;

    // React.useContext
    if ('type' in callee && callee.type === 'MemberExpression') {
      const member = callee as { object?: { value?: string }; property?: { value?: string } };
      return member.object?.value === 'React' && member.property?.value === 'useContext';
    }

    // useContext (직접 import)
    if ('type' in callee && callee.type === 'Identifier') {
      const ident = callee as { value?: string };
      return ident.value === 'useContext';
    }

    return false;
  }

  private findContextName(ast: Module, _call: unknown): string | null {
    // 변수 할당에서 이름 찾기
    // const MyContext = createContext(...) 형태
    for (const item of ast.body) {
      if (item.type === 'VariableDeclaration' || item.type === 'ExportDeclaration') {
        let varDecl: VariableDeclaration | null = null;

        if (item.type === 'VariableDeclaration') {
          varDecl = item;
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
              decl.init?.type === 'CallExpression' &&
              this.isCreateContextCall((decl.init as { callee: unknown }).callee)
            ) {
              return decl.id.value;
            }
          }
        }
      }
    }

    return null;
  }

  private extractContextFromUseContext(args: unknown[]): string | null {
    if (args.length === 0) return null;

    const firstArg = args[0];
    if (typeof firstArg === 'object' && firstArg !== null && 'type' in firstArg) {
      if (firstArg.type === 'Identifier') {
        return (firstArg as { value?: string }).value ?? null;
      }
    }

    return null;
  }

  private spanToLocation(span: { start: number; end: number }): SourceLocation {
    return {
      start: { line: 1, column: span.start },
      end: { line: 1, column: span.end },
    };
  }

  private createContextPattern(
    name: string,
    location: SourceLocation,
    extra: { hasProvider: boolean; hasConsumer: boolean }
  ): DetectedPattern {
    return {
      type: 'context',
      name,
      location,
      confidence: 0.9,
      metadata: {
        contextName: name,
        hasProvider: extra.hasProvider,
        hasConsumer: extra.hasConsumer,
      },
      needsReview: true, // Context는 도메인 경계 결정에 중요하므로 검토 필요
    };
  }
}

export const contextDetector = new ContextPatternDetector();
