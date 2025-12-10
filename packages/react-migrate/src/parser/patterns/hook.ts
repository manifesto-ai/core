import type { Module, FunctionDeclaration, VariableDeclaration, ExportDeclaration } from '@swc/core';
import type { DetectedPattern, PatternDetector, SourceLocation } from '../types.js';
import { findNodes } from '../swc-parser.js';

/**
 * React Hook 패턴 감지기
 */
export class HookPatternDetector implements PatternDetector {
  readonly type = 'hook' as const;

  /**
   * 내장 React Hooks
   */
  private readonly builtInHooks = new Set([
    'useState',
    'useEffect',
    'useContext',
    'useReducer',
    'useCallback',
    'useMemo',
    'useRef',
    'useImperativeHandle',
    'useLayoutEffect',
    'useDebugValue',
    'useDeferredValue',
    'useTransition',
    'useId',
    'useSyncExternalStore',
    'useInsertionEffect',
  ]);

  detect(ast: Module, _filePath: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // 1. Custom hooks (함수 선언)
    const customHooks = this.findCustomHooks(ast);
    patterns.push(...customHooks);

    // 2. Hook 사용 패턴 (useState, useReducer 등)
    const hookUsages = this.findHookUsages(ast);
    patterns.push(...hookUsages);

    return patterns;
  }

  private findCustomHooks(ast: Module): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const item of ast.body) {
      // export function useMyHook() { ... }
      if (item.type === 'ExportDeclaration') {
        const decl = (item as ExportDeclaration).declaration;
        if (decl?.type === 'FunctionDeclaration') {
          const funcDecl = decl as FunctionDeclaration;
          if (this.isHookName(funcDecl.identifier.value)) {
            patterns.push(this.createCustomHookPattern(
              funcDecl.identifier.value,
              this.spanToLocation(funcDecl.span),
              this.extractDependencies(funcDecl)
            ));
          }
        }
      }

      // function useMyHook() { ... }
      if (item.type === 'FunctionDeclaration') {
        const funcDecl = item as FunctionDeclaration;
        if (this.isHookName(funcDecl.identifier.value)) {
          patterns.push(this.createCustomHookPattern(
            funcDecl.identifier.value,
            this.spanToLocation(funcDecl.span),
            this.extractDependencies(funcDecl)
          ));
        }
      }

      // const useMyHook = () => { ... }
      // export const useMyHook = () => { ... }
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
            this.isHookName(decl.id.value) &&
            decl.init &&
            (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')
          ) {
            patterns.push(this.createCustomHookPattern(
              decl.id.value,
              this.spanToLocation(decl.span),
              []
            ));
          }
        }
      }
    }

    return patterns;
  }

  private findHookUsages(ast: Module): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Call expressions 찾기
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
      const hookName = this.extractHookName(call.callee);
      if (hookName && this.builtInHooks.has(hookName)) {
        // useState 특별 처리
        if (hookName === 'useState') {
          patterns.push(this.createStateHookPattern(
            hookName,
            this.spanToLocation(call.span),
            call.arguments
          ));
        }
        // useReducer 특별 처리
        else if (hookName === 'useReducer') {
          patterns.push(this.createReducerHookPattern(
            hookName,
            this.spanToLocation(call.span),
            call.arguments
          ));
        }
        // useEffect/useLayoutEffect 특별 처리
        else if (hookName === 'useEffect' || hookName === 'useLayoutEffect') {
          patterns.push(this.createEffectHookPattern(
            hookName,
            this.spanToLocation(call.span),
            call.arguments
          ));
        }
      }
    }

    return patterns;
  }

  private isHookName(name: string): boolean {
    return /^use[A-Z]/.test(name);
  }

  private extractHookName(callee: unknown): string | null {
    if (typeof callee !== 'object' || callee === null) return null;

    // 직접 호출: useState()
    if ('type' in callee && callee.type === 'Identifier') {
      const ident = callee as { value?: string };
      return ident.value ?? null;
    }

    // React.useState()
    if ('type' in callee && callee.type === 'MemberExpression') {
      const member = callee as { object?: { value?: string }; property?: { value?: string } };
      if (member.object?.value === 'React') {
        return member.property?.value ?? null;
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

  private createCustomHookPattern(
    name: string,
    location: SourceLocation,
    dependencies: string[]
  ): DetectedPattern {
    return {
      type: 'hook',
      name,
      location,
      confidence: 0.95,
      metadata: {
        isCustomHook: true,
        dependencies,
      },
      needsReview: false,
    };
  }

  private createStateHookPattern(
    name: string,
    location: SourceLocation,
    _args: unknown[]
  ): DetectedPattern {
    return {
      type: 'hook',
      name,
      location,
      confidence: 1.0,
      metadata: {
        isCustomHook: false,
      },
      needsReview: false,
    };
  }

  private createReducerHookPattern(
    name: string,
    location: SourceLocation,
    _args: unknown[]
  ): DetectedPattern {
    return {
      type: 'reducer',
      name,
      location,
      confidence: 1.0,
      metadata: {
        isCustomHook: false,
      },
      needsReview: true, // Reducer는 도메인 액션으로 변환 가능성이 높아 검토 필요
    };
  }

  private createEffectHookPattern(
    name: string,
    location: SourceLocation,
    _args: unknown[]
  ): DetectedPattern {
    return {
      type: 'effect',
      name,
      location,
      confidence: 1.0,
      metadata: {
        isCustomHook: false,
      },
      needsReview: false,
    };
  }

  private extractDependencies(_funcDecl: FunctionDeclaration): string[] {
    // 간단한 구현 - 향후 확장
    return [];
  }
}

export const hookDetector = new HookPatternDetector();
