import type { Module } from '@swc/core';
import type { DetectedPattern, PatternDetector, SourceLocation, PatternMetadata } from '../types.js';
import { findNodes } from '../swc-parser.js';

/**
 * TypeScript Interface/Type 패턴 감지기
 * State, Action, Context Value 등의 타입에서 엔티티 정보를 추출
 */
export class TypeScriptPatternDetector implements PatternDetector {
  readonly type = 'unknown' as const; // 타입 정의는 별도 패턴 타입이 아님

  detect(ast: Module, filePath: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // 1. Interface 정의 찾기
    const interfaces = this.findInterfaces(ast, filePath);
    patterns.push(...interfaces);

    // 2. Type Alias 찾기 (특히 Action 타입)
    const typeAliases = this.findTypeAliases(ast, filePath);
    patterns.push(...typeAliases);

    // 3. 초기 상태 변수 찾기
    const initialStates = this.findInitialState(ast, filePath);
    patterns.push(...initialStates);

    return patterns;
  }

  private findInterfaces(ast: Module, filePath: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const item of ast.body) {
      // interface Xxx { ... }
      if (item.type === 'TsInterfaceDeclaration') {
        const iface = item as {
          id: { value: string };
          body: { body: unknown[] };
          span: { start: number; end: number };
        };

        const name = iface.id.value;
        const fields = this.extractInterfaceFields(iface.body.body);

        // State 인터페이스 감지
        if (name.endsWith('State') || name.includes('State')) {
          patterns.push({
            type: 'reducer',
            name: name,
            location: this.spanToLocation(iface.span),
            confidence: 0.85,
            metadata: {
              stateShape: this.fieldsToStateShape(fields),
              sourceFile: filePath,
              interfaceName: name,
            },
            needsReview: false,
          });
        }

        // ContextValue 인터페이스 감지
        if (name.endsWith('ContextValue') || name.includes('Context')) {
          patterns.push({
            type: 'context',
            name: name,
            location: this.spanToLocation(iface.span),
            confidence: 0.85,
            metadata: {
              contextName: name.replace('ContextValue', '').replace('Context', ''),
              contextValue: JSON.stringify(this.fieldsToStateShape(fields)),
              sourceFile: filePath,
            },
            needsReview: false,
          });
        }

        // Props 인터페이스 감지
        if (name.endsWith('Props')) {
          patterns.push({
            type: 'component',
            name: name.replace('Props', ''),
            location: this.spanToLocation(iface.span),
            confidence: 0.8,
            metadata: {
              props: fields.map(f => f.name),
              sourceFile: filePath,
            },
            needsReview: false,
          });
        }

        // 일반 데이터 인터페이스 (State, Context, Props가 아닌 것)
        if (!name.endsWith('State') && !name.includes('Context') && !name.endsWith('Props')) {
          patterns.push({
            type: 'unknown',
            name: name,
            location: this.spanToLocation(iface.span),
            confidence: 0.7,
            metadata: {
              entityFields: fields,
              sourceFile: filePath,
              isEntity: true,
            },
            needsReview: false,
          });
        }
      }

      // export interface Xxx { ... }
      if (item.type === 'ExportDeclaration') {
        const exportDecl = item as { declaration?: { type: string } };
        if (exportDecl.declaration?.type === 'TsInterfaceDeclaration') {
          const iface = exportDecl.declaration as unknown as {
            id: { value: string };
            body: { body: unknown[] };
            span: { start: number; end: number };
          };

          const name = iface.id.value;
          const fields = this.extractInterfaceFields(iface.body.body);

          if (name.endsWith('State')) {
            patterns.push({
              type: 'reducer',
              name: name,
              location: this.spanToLocation(iface.span),
              confidence: 0.85,
              metadata: {
                stateShape: this.fieldsToStateShape(fields),
                sourceFile: filePath,
                interfaceName: name,
              },
              needsReview: false,
            });
          }
        }
      }
    }

    return patterns;
  }

  private findTypeAliases(ast: Module, filePath: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const item of ast.body) {
      // type XxxAction = { type: 'A' } | { type: 'B' }
      if (item.type === 'TsTypeAliasDeclaration') {
        const typeAlias = item as {
          id: { value: string };
          typeAnnotation: unknown;
          span: { start: number; end: number };
        };

        const name = typeAlias.id.value;

        // Action 타입 감지
        if (name.endsWith('Action') || name.includes('Action')) {
          const actions = this.extractActionsFromUnionType(typeAlias.typeAnnotation);
          if (actions.length > 0) {
            patterns.push({
              type: 'reducer',
              name: name,
              location: this.spanToLocation(typeAlias.span),
              confidence: 0.9,
              metadata: {
                actions: actions,
                sourceFile: filePath,
                isActionType: true,
              },
              needsReview: false,
            });
          }
        }
      }
    }

    return patterns;
  }

  private findInitialState(ast: Module, filePath: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const item of ast.body) {
      if (item.type === 'VariableDeclaration') {
        const varDecl = item as {
          declarations: Array<{
            id: { type: string; value?: string };
            init?: { type: string; properties?: unknown[] };
            span: { start: number; end: number };
          }>;
        };

        for (const decl of varDecl.declarations) {
          if (decl.id.type === 'Identifier' && decl.id.value) {
            const varName = decl.id.value;

            // initialState 변수 감지
            if (varName === 'initialState' || varName.endsWith('InitialState')) {
              if (decl.init?.type === 'ObjectExpression' && decl.init.properties) {
                const stateShape = this.extractObjectLiteralShape(decl.init.properties);
                patterns.push({
                  type: 'reducer',
                  name: varName,
                  location: this.spanToLocation(decl.span),
                  confidence: 0.95,
                  metadata: {
                    stateShape: stateShape,
                    sourceFile: filePath,
                    initialState: stateShape,
                  },
                  needsReview: false,
                });
              }
            }
          }
        }
      }
    }

    return patterns;
  }

  private extractInterfaceFields(body: unknown[]): Array<{ name: string; type: string; optional: boolean }> {
    const fields: Array<{ name: string; type: string; optional: boolean }> = [];

    for (const member of body) {
      if (typeof member === 'object' && member !== null && 'type' in member) {
        if (member.type === 'TsPropertySignature') {
          const prop = member as unknown as {
            key: { type: string; value?: string };
            optional?: boolean;
            typeAnnotation?: { typeAnnotation?: { type: string } };
          };

          if (prop.key.type === 'Identifier' && prop.key.value) {
            const fieldType = this.extractTypeFromAnnotation(prop.typeAnnotation?.typeAnnotation);
            fields.push({
              name: prop.key.value,
              type: fieldType,
              optional: prop.optional ?? false,
            });
          }
        }

        // 메서드 시그니처
        if (member.type === 'TsMethodSignature') {
          const method = member as unknown as {
            key: { type: string; value?: string };
          };

          if (method.key.type === 'Identifier' && method.key.value) {
            fields.push({
              name: method.key.value,
              type: 'function',
              optional: false,
            });
          }
        }
      }
    }

    return fields;
  }

  private extractTypeFromAnnotation(typeAnn: unknown): string {
    if (!typeAnn || typeof typeAnn !== 'object') return 'unknown';

    const type = typeAnn as { type: string; kind?: string; elementType?: unknown; types?: unknown[] };

    switch (type.type) {
      case 'TsKeywordType':
        return this.keywordToType(type.kind ?? '');
      case 'TsTypeReference':
        return this.extractTypeReference(type);
      case 'TsArrayType':
        return `${this.extractTypeFromAnnotation(type.elementType)}[]`;
      case 'TsUnionType':
        return type.types
          ?.map(t => this.extractTypeFromAnnotation(t))
          .join(' | ') ?? 'unknown';
      default:
        return 'unknown';
    }
  }

  private keywordToType(kind: string): string {
    switch (kind) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'null': return 'null';
      case 'undefined': return 'undefined';
      case 'any': return 'any';
      case 'void': return 'void';
      default: return kind || 'unknown';
    }
  }

  private extractTypeReference(type: unknown): string {
    if (!type || typeof type !== 'object') return 'unknown';

    const ref = type as { typeName?: { type: string; value?: string } };
    if (ref.typeName?.type === 'Identifier' && ref.typeName.value) {
      return ref.typeName.value;
    }

    return 'unknown';
  }

  private fieldsToStateShape(fields: Array<{ name: string; type: string; optional: boolean }>): Record<string, string> {
    const shape: Record<string, string> = {};
    for (const field of fields) {
      shape[field.name] = field.type;
    }
    return shape;
  }

  private extractActionsFromUnionType(typeAnnotation: unknown): string[] {
    const actions: string[] = [];

    if (!typeAnnotation || typeof typeAnnotation !== 'object') return actions;

    const type = typeAnnotation as { type: string; types?: unknown[] };

    if (type.type === 'TsUnionType' && type.types) {
      for (const unionMember of type.types) {
        const memberType = unionMember as { type: string; members?: unknown[] };

        if (memberType.type === 'TsTypeLiteral' && memberType.members) {
          for (const member of memberType.members) {
            const prop = member as {
              type: string;
              key?: { value?: string };
              typeAnnotation?: { typeAnnotation?: { type: string; literal?: { value?: string } } };
            };

            if (
              prop.type === 'TsPropertySignature' &&
              prop.key?.value === 'type' &&
              prop.typeAnnotation?.typeAnnotation?.type === 'TsLiteralType'
            ) {
              const literal = prop.typeAnnotation.typeAnnotation.literal as { value?: string };
              if (literal?.value) {
                actions.push(literal.value);
              }
            }
          }
        }
      }
    }

    return actions;
  }

  private extractObjectLiteralShape(properties: unknown[]): Record<string, unknown> {
    const shape: Record<string, unknown> = {};

    for (const prop of properties) {
      if (typeof prop !== 'object' || prop === null) continue;

      const property = prop as {
        type: string;
        key?: { type: string; value?: string };
        value?: { type: string; value?: unknown };
      };

      if (property.type === 'KeyValueProperty' && property.key?.value) {
        const key = property.key.value;
        const value = this.extractLiteralValue(property.value);
        shape[key] = value;
      }
    }

    return shape;
  }

  private extractLiteralValue(value: unknown): unknown {
    if (!value || typeof value !== 'object') return null;

    const val = value as { type: string; value?: unknown };

    switch (val.type) {
      case 'StringLiteral':
        return val.value;
      case 'NumericLiteral':
        return val.value;
      case 'BooleanLiteral':
        return val.value;
      case 'NullLiteral':
        return null;
      case 'Identifier':
        return (val as { value?: string }).value ?? null;
      default:
        return null;
    }
  }

  private spanToLocation(span: { start: number; end: number }): SourceLocation {
    return {
      start: { line: 1, column: span.start },
      end: { line: 1, column: span.end },
    };
  }
}

export const typescriptDetector = new TypeScriptPatternDetector();
