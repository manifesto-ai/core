import type {
  SemanticPath,
  ManifestoDomain,
  SourceDefinition,
  DerivedDefinition,
  AsyncDefinition,
} from '../domain/types.js';
import { extractPaths } from '../expression/parser.js';

/**
 * DagNode: 그래프 노드
 */
export type DagNode = SourceNode | DerivedNode | AsyncNode;

export type SourceNode = {
  kind: 'source';
  path: SemanticPath;
  definition: SourceDefinition;
};

export type DerivedNode = {
  kind: 'derived';
  path: SemanticPath;
  definition: DerivedDefinition;
};

export type AsyncNode = {
  kind: 'async';
  path: SemanticPath;
  definition: AsyncDefinition;
};

/**
 * DependencyGraph: Semantic Path 간 의존 관계 그래프
 */
export type DependencyGraph = {
  /** 모든 노드 */
  nodes: Map<SemanticPath, DagNode>;

  /** 정방향 엣지: path → 이 path가 의존하는 것들 */
  dependencies: Map<SemanticPath, Set<SemanticPath>>;

  /** 역방향 엣지: path → 이 path를 의존하는 것들 */
  dependents: Map<SemanticPath, Set<SemanticPath>>;

  /** 위상 정렬된 순서 */
  topologicalOrder: SemanticPath[];
};

/**
 * 도메인에서 의존성 그래프 구축
 */
export function buildDependencyGraph<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): DependencyGraph {
  const nodes = new Map<SemanticPath, DagNode>();
  const dependencies = new Map<SemanticPath, Set<SemanticPath>>();
  const dependents = new Map<SemanticPath, Set<SemanticPath>>();

  // 1. Source 노드 추가
  for (const [path, definition] of Object.entries(domain.paths.sources)) {
    nodes.set(path, { kind: 'source', path, definition });
    dependencies.set(path, new Set());
    if (!dependents.has(path)) {
      dependents.set(path, new Set());
    }
  }

  // 2. Derived 노드 추가
  for (const [path, definition] of Object.entries(domain.paths.derived)) {
    nodes.set(path, { kind: 'derived', path, definition });

    // Expression에서 의존성 추출
    const deps = new Set<SemanticPath>(definition.deps);
    const exprDeps = extractPaths(definition.expr);
    for (const dep of exprDeps) {
      if (!dep.startsWith('$')) {
        deps.add(dep);
      }
    }

    dependencies.set(path, deps);

    // 역방향 엣지 추가
    for (const dep of deps) {
      if (!dependents.has(dep)) {
        dependents.set(dep, new Set());
      }
      dependents.get(dep)!.add(path);
    }

    if (!dependents.has(path)) {
      dependents.set(path, new Set());
    }
  }

  // 3. Async 노드 추가
  for (const [path, definition] of Object.entries(domain.paths.async)) {
    nodes.set(path, { kind: 'async', path, definition });

    // Async의 의존성
    const deps = new Set<SemanticPath>(definition.deps);
    if (definition.condition) {
      const condDeps = extractPaths(definition.condition);
      for (const dep of condDeps) {
        if (!dep.startsWith('$')) {
          deps.add(dep);
        }
      }
    }

    dependencies.set(path, deps);

    // 역방향 엣지 추가
    for (const dep of deps) {
      if (!dependents.has(dep)) {
        dependents.set(dep, new Set());
      }
      dependents.get(dep)!.add(path);
    }

    // result, loading, error 경로도 노드로 등록 (source처럼 취급)
    for (const statePath of [
      definition.resultPath,
      definition.loadingPath,
      definition.errorPath,
    ]) {
      if (!nodes.has(statePath)) {
        // Async 결과 경로는 특별한 source로 취급
        dependencies.set(statePath, new Set([path]));
        if (!dependents.has(statePath)) {
          dependents.set(statePath, new Set());
        }
        dependents.get(path)!.add(statePath);
      }
    }

    if (!dependents.has(path)) {
      dependents.set(path, new Set());
    }
  }

  // 4. 위상 정렬
  const topologicalOrder = topologicalSort(nodes, dependencies);

  return {
    nodes,
    dependencies,
    dependents,
    topologicalOrder,
  };
}

/**
 * 위상 정렬 (Kahn's algorithm)
 */
function topologicalSort(
  nodes: Map<SemanticPath, DagNode>,
  dependencies: Map<SemanticPath, Set<SemanticPath>>
): SemanticPath[] {
  const inDegree = new Map<SemanticPath, number>();
  const result: SemanticPath[] = [];

  // 진입 차수 계산
  for (const path of nodes.keys()) {
    inDegree.set(path, 0);
  }

  for (const [path, deps] of dependencies) {
    for (const dep of deps) {
      if (nodes.has(dep)) {
        inDegree.set(path, (inDegree.get(path) ?? 0) + 1);
      }
    }
  }

  // 진입 차수가 0인 노드들로 시작
  const queue: SemanticPath[] = [];
  for (const [path, degree] of inDegree) {
    if (degree === 0) {
      queue.push(path);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    // 현재 노드를 의존하는 노드들의 진입 차수 감소
    for (const [path, deps] of dependencies) {
      if (deps.has(current)) {
        const newDegree = (inDegree.get(path) ?? 0) - 1;
        inDegree.set(path, newDegree);
        if (newDegree === 0) {
          queue.push(path);
        }
      }
    }
  }

  return result;
}

/**
 * 특정 경로의 직접 의존성 조회
 */
export function getDirectDependencies(
  graph: DependencyGraph,
  path: SemanticPath
): SemanticPath[] {
  return [...(graph.dependencies.get(path) ?? [])];
}

/**
 * 특정 경로를 직접 의존하는 경로들 조회
 */
export function getDirectDependents(
  graph: DependencyGraph,
  path: SemanticPath
): SemanticPath[] {
  return [...(graph.dependents.get(path) ?? [])];
}

/**
 * 특정 경로의 모든 의존성 조회 (전이적)
 */
export function getAllDependencies(
  graph: DependencyGraph,
  path: SemanticPath
): SemanticPath[] {
  const result = new Set<SemanticPath>();
  const visited = new Set<SemanticPath>();

  function traverse(current: SemanticPath): void {
    if (visited.has(current)) return;
    visited.add(current);

    const deps = graph.dependencies.get(current);
    if (deps) {
      for (const dep of deps) {
        result.add(dep);
        traverse(dep);
      }
    }
  }

  traverse(path);
  return [...result];
}

/**
 * 특정 경로를 의존하는 모든 경로 조회 (전이적)
 */
export function getAllDependents(
  graph: DependencyGraph,
  path: SemanticPath
): SemanticPath[] {
  const result = new Set<SemanticPath>();
  const visited = new Set<SemanticPath>();

  function traverse(current: SemanticPath): void {
    if (visited.has(current)) return;
    visited.add(current);

    const deps = graph.dependents.get(current);
    if (deps) {
      for (const dep of deps) {
        result.add(dep);
        traverse(dep);
      }
    }
  }

  traverse(path);
  return [...result];
}

/**
 * 순환 의존성이 있는지 확인
 */
export function hasCycle(graph: DependencyGraph): boolean {
  const visited = new Set<SemanticPath>();
  const recursionStack = new Set<SemanticPath>();

  function dfs(path: SemanticPath): boolean {
    visited.add(path);
    recursionStack.add(path);

    const deps = graph.dependencies.get(path);
    if (deps) {
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (dfs(dep)) return true;
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }
    }

    recursionStack.delete(path);
    return false;
  }

  for (const path of graph.nodes.keys()) {
    if (!visited.has(path)) {
      if (dfs(path)) return true;
    }
  }

  return false;
}

/**
 * 두 경로 사이의 경로 찾기 (BFS)
 */
export function findPath(
  graph: DependencyGraph,
  from: SemanticPath,
  to: SemanticPath
): SemanticPath[] | null {
  if (from === to) return [from];

  const visited = new Set<SemanticPath>();
  const queue: { path: SemanticPath; trail: SemanticPath[] }[] = [
    { path: from, trail: [from] },
  ];

  while (queue.length > 0) {
    const { path, trail } = queue.shift()!;

    if (visited.has(path)) continue;
    visited.add(path);

    const deps = graph.dependents.get(path);
    if (deps) {
      for (const dep of deps) {
        if (dep === to) {
          return [...trail, dep];
        }
        if (!visited.has(dep)) {
          queue.push({ path: dep, trail: [...trail, dep] });
        }
      }
    }
  }

  return null;
}
