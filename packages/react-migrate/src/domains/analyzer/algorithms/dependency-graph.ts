/**
 * Dependency Graph Builder
 *
 * 파일 간의 import/export 관계를 분석하여 의존성 그래프를 구축합니다.
 */

import type { FileAnalysis, ImportInfo } from '../../../parser/types.js';
import type { DependencyGraph, ImportEdge } from '../types.js';
import * as path from 'path';

/**
 * 의존성 그래프 노드 정보
 */
export interface DependencyNode {
  /** 파일 경로 */
  path: string;
  /** import하는 엣지들 */
  imports: ImportEdge[];
  /** export 이름들 */
  exports: string[];
  /** 제공하는 Context 이름들 */
  providesContext: string[];
  /** 소비하는 Context 이름들 */
  consumesContext: string[];
  /** in-degree (이 파일을 import하는 파일 수) */
  inDegree: number;
  /** out-degree (이 파일이 import하는 파일 수) */
  outDegree: number;
}

/**
 * 그래프 분석 결과
 */
export interface GraphAnalysis {
  /** 노드 정보 맵 */
  nodes: Map<string, DependencyNode>;
  /** 순환 의존성 */
  cycles: string[][];
  /** 연결 컴포넌트 (클러스터) */
  connectedComponents: string[][];
  /** 진입점 (아무도 import하지 않는 파일) */
  entryPoints: string[];
  /** 리프 (아무것도 import하지 않는 파일) */
  leafNodes: string[];
}

/**
 * Import 경로를 실제 파일 경로로 해석
 */
export function resolveImportPath(
  fromFile: string,
  importSource: string,
  allFiles: string[]
): string | null {
  // 외부 모듈은 무시
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  let resolved = path.resolve(fromDir, importSource);

  // 확장자가 없으면 시도
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

  // 정확히 일치하는지 확인
  if (allFiles.includes(resolved)) {
    return resolved;
  }

  // 확장자 추가해서 시도
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (allFiles.includes(withExt)) {
      return withExt;
    }
  }

  // 확장자를 제거하고 다시 시도
  const withoutExt = resolved.replace(/\.(tsx?|jsx?)$/, '');
  for (const ext of extensions) {
    const tryPath = withoutExt + ext;
    if (allFiles.includes(tryPath)) {
      return tryPath;
    }
  }

  return null;
}

/**
 * FileAnalysis에서 Context 정보 추출
 */
function extractContextInfo(analysis: FileAnalysis): {
  provides: string[];
  consumes: string[];
} {
  const provides: string[] = [];
  const consumes: string[] = [];

  for (const pattern of analysis.patterns) {
    if (pattern.type === 'context') {
      const contextName = pattern.metadata.contextName as string | undefined;
      if (contextName) {
        if (pattern.metadata.hasProvider) {
          provides.push(contextName);
        }
        if (pattern.metadata.hasConsumer) {
          consumes.push(contextName);
        }
      }
    }
  }

  return { provides, consumes };
}

/**
 * 의존성 그래프 구축
 */
export function buildDependencyGraph(
  analyses: FileAnalysis[]
): DependencyGraph {
  const allFiles = analyses.map(a => a.path);
  const nodes: string[] = [...allFiles];
  const edges: ImportEdge[] = [];

  for (const analysis of analyses) {
    for (const imp of analysis.imports) {
      const target = resolveImportPath(analysis.path, imp.source, allFiles);

      if (target) {
        // re-export 여부 확인
        const isReexport = analysis.exports.some(exp =>
          imp.specifiers.some(spec => spec.name === exp.name)
        );

        edges.push({
          source: analysis.path,
          target,
          specifiers: imp.specifiers.map(s => s.name),
          isReexport,
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * 그래프 상세 분석
 */
export function analyzeGraph(
  analyses: FileAnalysis[],
  graph: DependencyGraph
): GraphAnalysis {
  const nodeMap = new Map<string, DependencyNode>();

  // 노드 초기화
  for (const analysis of analyses) {
    const contextInfo = extractContextInfo(analysis);

    nodeMap.set(analysis.path, {
      path: analysis.path,
      imports: [],
      exports: analysis.exports.map(e => e.name),
      providesContext: contextInfo.provides,
      consumesContext: contextInfo.consumes,
      inDegree: 0,
      outDegree: 0,
    });
  }

  // 엣지 처리
  for (const edge of graph.edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (sourceNode) {
      sourceNode.imports.push(edge);
      sourceNode.outDegree++;
    }

    if (targetNode) {
      targetNode.inDegree++;
    }
  }

  // 진입점 찾기 (in-degree가 0인 노드)
  const entryPoints = Array.from(nodeMap.values())
    .filter(n => n.inDegree === 0)
    .map(n => n.path);

  // 리프 노드 찾기 (out-degree가 0인 노드)
  const leafNodes = Array.from(nodeMap.values())
    .filter(n => n.outDegree === 0)
    .map(n => n.path);

  // 순환 의존성 찾기
  const cycles = findCycles(graph);

  // 연결 컴포넌트 찾기
  const connectedComponents = findConnectedComponents(graph);

  return {
    nodes: nodeMap,
    cycles,
    connectedComponents,
    entryPoints,
    leafNodes,
  };
}

/**
 * 순환 의존성 찾기 (Tarjan's algorithm)
 */
export function findCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  // 인접 리스트 구축
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // 사이클 발견
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  for (const node of graph.nodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * 연결 컴포넌트 찾기 (무방향으로 취급)
 */
export function findConnectedComponents(graph: DependencyGraph): string[][] {
  const components: string[][] = [];
  const visited = new Set<string>();

  // 무방향 인접 리스트 구축
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    adjacency.set(node, new Set());
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  function bfs(start: string): string[] {
    const component: string[] = [];
    const queue: string[] = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      const neighbors = adjacency.get(current) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return component;
  }

  for (const node of graph.nodes) {
    if (!visited.has(node)) {
      const component = bfs(node);
      if (component.length > 0) {
        components.push(component);
      }
    }
  }

  return components;
}

/**
 * 특정 노드의 모든 종속 노드 찾기 (transitive dependencies)
 */
export function findAllDependencies(
  graph: DependencyGraph,
  startNode: string
): Set<string> {
  const dependencies = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [startNode];

  // 인접 리스트
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      dependencies.add(neighbor);
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return dependencies;
}

/**
 * 특정 노드를 사용하는 모든 노드 찾기 (reverse dependencies)
 */
export function findAllDependents(
  graph: DependencyGraph,
  targetNode: string
): Set<string> {
  const dependents = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [targetNode];

  // 역방향 인접 리스트
  const reverseAdjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    reverseAdjacency.set(node, []);
  }
  for (const edge of graph.edges) {
    reverseAdjacency.get(edge.target)?.push(edge.source);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = reverseAdjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      dependents.add(neighbor);
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return dependents;
}

/**
 * Context 공유 관계 분석
 */
export function analyzeContextSharing(
  graphAnalysis: GraphAnalysis
): Map<string, string[]> {
  // Context 이름 → 사용하는 파일들
  const contextUsage = new Map<string, string[]>();

  for (const [path, node] of graphAnalysis.nodes) {
    // Provider
    for (const ctx of node.providesContext) {
      if (!contextUsage.has(ctx)) {
        contextUsage.set(ctx, []);
      }
      contextUsage.get(ctx)!.push(path);
    }

    // Consumer
    for (const ctx of node.consumesContext) {
      if (!contextUsage.has(ctx)) {
        contextUsage.set(ctx, []);
      }
      const users = contextUsage.get(ctx)!;
      if (!users.includes(path)) {
        users.push(path);
      }
    }
  }

  return contextUsage;
}

/**
 * 두 파일 간의 관계 강도 계산 (0-1)
 */
export function calculateRelationshipStrength(
  graph: DependencyGraph,
  file1: string,
  file2: string
): number {
  let strength = 0;

  // 직접 import 관계
  const directEdge = graph.edges.find(
    e => (e.source === file1 && e.target === file2) ||
         (e.source === file2 && e.target === file1)
  );

  if (directEdge) {
    strength += 0.5;
    // re-export면 더 강한 관계
    if (directEdge.isReexport) {
      strength += 0.2;
    }
    // import하는 항목이 많으면 더 강한 관계
    strength += Math.min(directEdge.specifiers.length * 0.05, 0.2);
  }

  // 같은 컴포넌트에 속하면 관계 있음
  const components = findConnectedComponents(graph);
  const sameComponent = components.find(
    c => c.includes(file1) && c.includes(file2)
  );

  if (sameComponent && !directEdge) {
    strength += 0.1;
  }

  return Math.min(strength, 1);
}
