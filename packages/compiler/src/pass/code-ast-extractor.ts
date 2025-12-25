/**
 * Code AST Extractor Pass
 *
 * SWC 기반으로 JavaScript/TypeScript 코드를 파싱하고
 * AST 노드에서 Finding을 추출합니다.
 *
 * Priority: 0 (가장 먼저 실행)
 * Category: extractor
 */

import { parseSync, type Module, type Script, type Span } from '@swc/core';
import type { Artifact, CodeArtifact, SelectionSpan } from '../types/artifact.js';
import { isCodeArtifact } from '../types/artifact.js';
import type { Provenance } from '../types/provenance.js';
import { createProvenance, codeOrigin } from '../types/provenance.js';
import type {
  Pass,
  PassContext,
  Finding,
  FindingKind,
  FindingData,
  VariableDeclarationData,
  FunctionDeclarationData,
  FunctionCallData,
  AssignmentData,
  IfStatementData,
  BinaryExpressionData,
} from './base.js';
import { createFindingId } from './base.js';

// ============================================================================
// Types
// ============================================================================

/**
 * SWC 노드 공통 인터페이스
 */
interface SwcNode {
  type: string;
  span: Span;
}

/**
 * AST Visitor 콜백
 */
type VisitorCallback = (node: SwcNode, parent?: SwcNode) => void;

// ============================================================================
// Code AST Extractor Pass
// ============================================================================

/**
 * Code AST Extractor Pass
 *
 * JS/TS 코드에서 AST를 파싱하고 Finding을 추출합니다.
 */
export const codeAstExtractorPass: Pass = {
  name: 'code-ast-extractor',
  priority: 0,
  category: 'extractor',

  supports(artifact: Artifact): boolean {
    return isCodeArtifact(artifact);
  },

  analyze(ctx: PassContext): Finding[] {
    const artifact = ctx.artifact as CodeArtifact;
    const findings: Finding[] = [];

    try {
      // Parse the code with SWC
      const ast = parseCode(artifact.content, artifact.language);
      if (!ast) {
        ctx.log('warn', `Failed to parse artifact ${artifact.id}`);
        return findings;
      }

      // Visit all nodes and extract findings
      visitAst(ast, (node, parent, normalizedSpan) => {
        // Check if node is in selection (if selection is specified)
        if (!isInSelectionNormalized(normalizedSpan, ctx.selection, artifact.content)) {
          return;
        }

        const finding = extractFinding(node, parent, artifact, ctx, normalizedSpan);
        if (finding) {
          findings.push(finding);
        }
      });
    } catch (error) {
      ctx.log('error', `Error parsing artifact ${artifact.id}`, error);
    }

    return findings;
  },

  compile(): [] {
    // Extractor passes don't produce fragments directly
    // They only extract findings for other passes to use
    return [];
  },
};

// ============================================================================
// SWC Parsing
// ============================================================================

/**
 * Parse code using SWC
 */
function parseCode(content: string, language: 'js' | 'ts' | 'json'): Module | Script | null {
  if (language === 'json') {
    // JSON is not parseable as JS/TS code
    return null;
  }

  const isTypeScript = language === 'ts';

  try {
    return parseSync(content, {
      syntax: isTypeScript ? 'typescript' : 'ecmascript',
      tsx: isTypeScript,
      jsx: !isTypeScript,
      target: 'es2022',
      comments: false,
    });
  } catch {
    return null;
  }
}

// ============================================================================
// AST Visitor
// ============================================================================

/**
 * Normalized visitor callback - receives span adjusted to 0-based relative offsets
 */
type NormalizedVisitorCallback = (
  node: SwcNode,
  parent: SwcNode | undefined,
  normalizedSpan: { start: number; end: number }
) => void;

/**
 * Visit all nodes in the AST with normalized spans
 *
 * SWC's parseSync accumulates span positions across calls.
 * We normalize by subtracting the module's base span.
 */
function visitAst(ast: Module | Script, callback: NormalizedVisitorCallback): void {
  // Get the base span from the module/script to normalize all other spans
  const baseSpan = ast.span?.start ?? 1;

  const visit = (node: unknown, parent?: SwcNode): void => {
    if (!node || typeof node !== 'object') return;

    const typedNode = node as SwcNode;

    // If it has a type and span, it's a visitable node
    if (typedNode.type && typedNode.span) {
      // Normalize the span by subtracting the base and converting to 0-based
      const normalizedSpan = {
        start: Math.max(0, typedNode.span.start - baseSpan),
        end: Math.max(0, typedNode.span.end - baseSpan),
      };
      callback(typedNode, parent, normalizedSpan);
    }

    // Visit all properties recursively
    for (const key of Object.keys(node as object)) {
      const value = (node as Record<string, unknown>)[key];

      if (Array.isArray(value)) {
        for (const item of value) {
          visit(item, typedNode.type ? typedNode : parent);
        }
      } else if (value && typeof value === 'object') {
        visit(value, typedNode.type ? typedNode : parent);
      }
    }
  };

  visit(ast);
}

// ============================================================================
// Selection Filtering
// ============================================================================

/**
 * Check if a normalized span is within the selection
 *
 * Normalized spans are already 0-based.
 */
function isInSelectionNormalized(
  normalizedSpan: { start: number; end: number },
  selection: SelectionSpan | undefined,
  content: string
): boolean {
  if (!selection) return true;

  const nodeStart = normalizedSpan.start;
  const nodeEnd = normalizedSpan.end;

  // Use offset-based selection if available
  if (selection.startOffset !== undefined && selection.endOffset !== undefined) {
    return nodeStart >= selection.startOffset && nodeEnd <= selection.endOffset;
  }

  // Use line-based selection if available (lines are 1-indexed)
  if (selection.startLine !== undefined && selection.endLine !== undefined) {
    const { startLine, endLine } = getLineFromOffset(nodeStart, nodeEnd, content);
    return startLine >= selection.startLine && endLine <= selection.endLine;
  }

  return true;
}

/**
 * Get line numbers from byte offsets
 */
function getLineFromOffset(
  startOffset: number,
  endOffset: number,
  content: string
): { startLine: number; endLine: number } {
  let startLine = 1;
  let endLine = 1;

  for (let i = 0; i < content.length && i < endOffset; i++) {
    if (content[i] === '\n') {
      if (i < startOffset) startLine++;
      if (i < endOffset) endLine++;
    }
  }

  return { startLine, endLine };
}

// ============================================================================
// Finding Extraction
// ============================================================================

/**
 * Extract a Finding from an AST node
 */
function extractFinding(
  node: SwcNode,
  parent: SwcNode | undefined,
  artifact: CodeArtifact,
  ctx: PassContext,
  normalizedSpan: { start: number; end: number }
): Finding | null {
  const sourceCode = getSourceCodeNormalized(artifact.content, normalizedSpan);
  const provenance = createNodeProvenanceNormalized(artifact, normalizedSpan, ctx);

  switch (node.type) {
    case 'VariableDeclaration':
      return extractVariableDeclaration(node, artifact, provenance, sourceCode);

    case 'FunctionDeclaration':
      return extractFunctionDeclaration(node, artifact, provenance, sourceCode);

    case 'CallExpression':
      return extractCallExpression(node, artifact, provenance, sourceCode);

    case 'AssignmentExpression':
      return extractAssignmentExpression(node, artifact, provenance, sourceCode);

    case 'IfStatement':
      return extractIfStatement(node, artifact, provenance, sourceCode);

    case 'BinaryExpression':
      // Skip if parent is also a BinaryExpression (avoid double counting)
      if (parent?.type === 'BinaryExpression') return null;
      return extractBinaryExpression(node, artifact, provenance, sourceCode);

    default:
      return null;
  }
}

/**
 * Get source code for a normalized span
 *
 * Normalized spans are already 0-based relative offsets.
 */
function getSourceCodeNormalized(
  content: string,
  normalizedSpan: { start: number; end: number }
): string {
  return content.slice(normalizedSpan.start, normalizedSpan.end);
}

/**
 * Create provenance for an AST node using normalized span
 */
function createNodeProvenanceNormalized(
  artifact: CodeArtifact,
  normalizedSpan: { start: number; end: number },
  ctx: PassContext
): Provenance {
  const lines = getLineFromOffset(normalizedSpan.start, normalizedSpan.end, artifact.content);

  return createProvenance(
    artifact.id,
    codeOrigin({
      startLine: lines.startLine,
      startCol: 0, // SWC doesn't provide column info easily
      endLine: lines.endLine,
      endCol: 0,
      file: artifact.filePath,
    })
  );
}

// ============================================================================
// Node Extractors
// ============================================================================

/**
 * Extract VariableDeclaration
 */
function extractVariableDeclaration(
  node: SwcNode,
  artifact: CodeArtifact,
  provenance: Provenance,
  sourceCode: string
): Finding | null {
  const varDecl = node as unknown as {
    kind: 'const' | 'let' | 'var';
    declarations: Array<{
      id: { type: string; value?: string; typeAnnotation?: unknown };
      init?: unknown;
    }>;
  };

  const declarations = varDecl.declarations;
  if (!declarations || declarations.length === 0) return null;

  // Extract first declaration
  const decl = declarations[0];
  if (!decl) return null;

  const id = decl.id;
  let name = '';
  let typeAnnotation: string | undefined;

  if (id.type === 'Identifier') {
    name = (id as unknown as { value: string }).value;
    if (id.typeAnnotation) {
      typeAnnotation = extractTypeAnnotation(id.typeAnnotation);
    }
  }

  if (!name) return null;

  const data: VariableDeclarationData = {
    kind: 'variable_declaration',
    name,
    varKind: varDecl.kind,
    typeAnnotation,
    initialValue: extractLiteralValue(decl.init),
    sourceCode,
  };

  return {
    id: createFindingId('code-ast-extractor'),
    kind: 'variable_declaration',
    passName: 'code-ast-extractor',
    artifactId: artifact.id,
    astNode: {
      type: node.type,
      span: node.span,
    },
    data,
    provenance,
  };
}

/**
 * Extract FunctionDeclaration
 */
function extractFunctionDeclaration(
  node: SwcNode,
  artifact: CodeArtifact,
  provenance: Provenance,
  sourceCode: string
): Finding | null {
  const funcDecl = node as unknown as {
    identifier: { value: string };
    params: Array<{
      pat: { type: string; value?: string; typeAnnotation?: unknown };
    }>;
    returnType?: unknown;
    async: boolean;
  };

  const name = funcDecl.identifier?.value;
  if (!name) return null;

  const params = (funcDecl.params || []).map((param) => {
    const pat = param.pat;
    let paramName = '';
    let paramType: string | undefined;

    if (pat.type === 'Identifier') {
      paramName = (pat as unknown as { value: string }).value;
      if (pat.typeAnnotation) {
        paramType = extractTypeAnnotation(pat.typeAnnotation);
      }
    }

    return { name: paramName, type: paramType };
  });

  const returnType = funcDecl.returnType
    ? extractTypeAnnotation(funcDecl.returnType)
    : undefined;

  const data: FunctionDeclarationData = {
    kind: 'function_declaration',
    name,
    params,
    returnType,
    isAsync: funcDecl.async || false,
    sourceCode,
  };

  return {
    id: createFindingId('code-ast-extractor'),
    kind: 'function_declaration',
    passName: 'code-ast-extractor',
    artifactId: artifact.id,
    astNode: {
      type: node.type,
      span: node.span,
    },
    data,
    provenance,
  };
}

/**
 * Extract CallExpression
 */
function extractCallExpression(
  node: SwcNode,
  artifact: CodeArtifact,
  provenance: Provenance,
  sourceCode: string
): Finding | null {
  const callExpr = node as unknown as {
    callee: { type: string; value?: string; object?: unknown; property?: unknown };
    arguments: Array<{ expression: unknown }>;
  };

  const callee = extractCallee(callExpr.callee);
  if (!callee) return null;

  const args = (callExpr.arguments || []).map((arg) => extractLiteralValue(arg.expression));

  const data: FunctionCallData = {
    kind: 'function_call',
    callee,
    arguments: args,
    sourceCode,
  };

  return {
    id: createFindingId('code-ast-extractor'),
    kind: 'function_call',
    passName: 'code-ast-extractor',
    artifactId: artifact.id,
    astNode: {
      type: node.type,
      span: node.span,
    },
    data,
    provenance,
  };
}

/**
 * Extract AssignmentExpression
 */
function extractAssignmentExpression(
  node: SwcNode,
  artifact: CodeArtifact,
  provenance: Provenance,
  sourceCode: string
): Finding | null {
  const assignExpr = node as unknown as {
    left: { type: string; value?: string };
    operator: string;
    right: unknown;
  };

  let target = '';
  if (assignExpr.left.type === 'Identifier') {
    target = assignExpr.left.value || '';
  } else if (assignExpr.left.type === 'MemberExpression') {
    target = extractMemberExpression(assignExpr.left);
  }

  if (!target) return null;

  // Map SWC operator to our operator types
  const operatorMap: Record<string, AssignmentData['operator']> = {
    '=': '=',
    '+=': '+=',
    '-=': '-=',
    '*=': '*=',
    '/=': '/=',
  };

  const operator = operatorMap[assignExpr.operator] || '=';

  const data: AssignmentData = {
    kind: 'assignment',
    target,
    operator,
    value: extractLiteralValue(assignExpr.right),
    sourceCode,
  };

  return {
    id: createFindingId('code-ast-extractor'),
    kind: 'assignment',
    passName: 'code-ast-extractor',
    artifactId: artifact.id,
    astNode: {
      type: node.type,
      span: node.span,
    },
    data,
    provenance,
  };
}

/**
 * Extract IfStatement
 */
function extractIfStatement(
  node: SwcNode,
  artifact: CodeArtifact,
  provenance: Provenance,
  sourceCode: string
): Finding | null {
  const ifStmt = node as unknown as {
    test: unknown;
    consequent: unknown;
    alternate?: unknown;
  };

  const data: IfStatementData = {
    kind: 'if_statement',
    condition: extractExpressionValue(ifStmt.test),
    consequentFindings: [], // Will be populated by other passes if needed
    alternateFindings: ifStmt.alternate ? [] : undefined,
    sourceCode,
  };

  return {
    id: createFindingId('code-ast-extractor'),
    kind: 'if_statement',
    passName: 'code-ast-extractor',
    artifactId: artifact.id,
    astNode: {
      type: node.type,
      span: node.span,
    },
    data,
    provenance,
  };
}

/**
 * Extract BinaryExpression
 */
function extractBinaryExpression(
  node: SwcNode,
  artifact: CodeArtifact,
  provenance: Provenance,
  sourceCode: string
): Finding | null {
  const binExpr = node as unknown as {
    operator: string;
    left: unknown;
    right: unknown;
  };

  const data: BinaryExpressionData = {
    kind: 'binary_expression',
    operator: binExpr.operator,
    left: extractExpressionValue(binExpr.left),
    right: extractExpressionValue(binExpr.right),
    sourceCode,
  };

  return {
    id: createFindingId('code-ast-extractor'),
    kind: 'binary_expression',
    passName: 'code-ast-extractor',
    artifactId: artifact.id,
    astNode: {
      type: node.type,
      span: node.span,
    },
    data,
    provenance,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract type annotation as string
 */
function extractTypeAnnotation(typeAnnotation: unknown): string | undefined {
  if (!typeAnnotation || typeof typeAnnotation !== 'object') return undefined;

  const ta = typeAnnotation as {
    typeAnnotation?: {
      type: string;
      typeName?: { value: string };
      kind?: string;
    };
  };

  const type = ta.typeAnnotation;
  if (!type) return undefined;

  switch (type.type) {
    case 'TsKeywordType':
      return type.kind; // 'number', 'string', 'boolean', etc.
    case 'TsTypeReference':
      return type.typeName?.value;
    default:
      return undefined;
  }
}

/**
 * Extract literal value from an AST node
 */
function extractLiteralValue(node: unknown): unknown {
  if (!node || typeof node !== 'object') return undefined;

  const typedNode = node as { type: string; value?: unknown; raw?: string };

  switch (typedNode.type) {
    case 'NumericLiteral':
      return typedNode.value;
    case 'StringLiteral':
      return typedNode.value;
    case 'BooleanLiteral':
      return typedNode.value;
    case 'NullLiteral':
      return null;
    case 'Identifier':
      return { type: 'identifier', name: (typedNode as { value: string }).value };
    default:
      return { type: 'expression', raw: typedNode.type };
  }
}

/**
 * Extract expression value (for condition, left/right operands)
 */
function extractExpressionValue(node: unknown): unknown {
  if (!node || typeof node !== 'object') return undefined;

  const typedNode = node as {
    type: string;
    value?: unknown;
    operator?: string;
    left?: unknown;
    right?: unknown;
  };

  switch (typedNode.type) {
    case 'NumericLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
      return typedNode.value;
    case 'NullLiteral':
      return null;
    case 'Identifier':
      return { type: 'identifier', name: (typedNode as { value: string }).value };
    case 'BinaryExpression':
      return {
        type: 'binary',
        operator: typedNode.operator,
        left: extractExpressionValue(typedNode.left),
        right: extractExpressionValue(typedNode.right),
      };
    case 'MemberExpression':
      return { type: 'member', path: extractMemberExpression(typedNode) };
    default:
      return { type: typedNode.type };
  }
}

/**
 * Extract callee from a CallExpression
 */
function extractCallee(callee: unknown): string | null {
  if (!callee || typeof callee !== 'object') return null;

  const typedCallee = callee as {
    type: string;
    value?: string;
    object?: unknown;
    property?: { value: string };
  };

  if (typedCallee.type === 'Identifier') {
    return typedCallee.value || null;
  }

  if (typedCallee.type === 'MemberExpression') {
    return extractMemberExpression(typedCallee);
  }

  return null;
}

/**
 * Extract member expression as a dotted path
 */
function extractMemberExpression(node: unknown): string {
  if (!node || typeof node !== 'object') return '';

  const typedNode = node as {
    type: string;
    value?: string;
    object?: unknown;
    property?: { value: string };
  };

  if (typedNode.type === 'Identifier') {
    return typedNode.value || '';
  }

  if (typedNode.type === 'MemberExpression') {
    const obj = extractMemberExpression(typedNode.object);
    const prop = typedNode.property?.value || '';
    return obj ? `${obj}.${prop}` : prop;
  }

  return '';
}

// ============================================================================
// Export
// ============================================================================

export default codeAstExtractorPass;
