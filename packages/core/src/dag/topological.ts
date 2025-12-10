import type { SemanticPath } from '../domain/types.js';
import type { DependencyGraph } from './graph.js';

/**
 * 위상 정렬 결과
 */
export type TopologicalSortResult =
  | { ok: true; order: SemanticPath[] }
  | { ok: false; cycle: SemanticPath[] };

/**
 * 고급 위상 정렬 (순환 탐지 포함)
 */
export function topologicalSortWithCycleDetection(
  graph: DependencyGraph
): TopologicalSortResult {
  const inDegree = new Map<SemanticPath, number>();
  const result: SemanticPath[] = [];

  // 진입 차수 초기화
  for (const path of graph.nodes.keys()) {
    inDegree.set(path, 0);
  }

  // 진입 차수 계산
  for (const [path, deps] of graph.dependencies) {
    let count = 0;
    for (const dep of deps) {
      if (graph.nodes.has(dep)) {
        count++;
      }
    }
    inDegree.set(path, count);
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
    const dependents = graph.dependents.get(current);
    if (dependents) {
      for (const dep of dependents) {
        const newDegree = (inDegree.get(dep) ?? 0) - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }
  }

  // 모든 노드가 포함되지 않았다면 순환이 있음
  if (result.length !== graph.nodes.size) {
    const cycle = findCycleNodes(graph, inDegree);
    return { ok: false, cycle };
  }

  return { ok: true, order: result };
}

/**
 * 순환에 포함된 노드 찾기
 */
function findCycleNodes(
  graph: DependencyGraph,
  inDegree: Map<SemanticPath, number>
): SemanticPath[] {
  const cycleNodes: SemanticPath[] = [];

  for (const [path, degree] of inDegree) {
    if (degree > 0) {
      cycleNodes.push(path);
    }
  }

  // DFS로 실제 순환 경로 찾기
  if (cycleNodes.length > 0) {
    const visited = new Set<SemanticPath>();
    const recursionStack: SemanticPath[] = [];
    const pathSet = new Set<SemanticPath>();

    function dfs(node: SemanticPath): SemanticPath[] | null {
      visited.add(node);
      recursionStack.push(node);
      pathSet.add(node);

      const deps = graph.dependencies.get(node);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            const cycle = dfs(dep);
            if (cycle) return cycle;
          } else if (pathSet.has(dep)) {
            // 순환 발견
            const cycleStart = recursionStack.indexOf(dep);
            return recursionStack.slice(cycleStart);
          }
        }
      }

      recursionStack.pop();
      pathSet.delete(node);
      return null;
    }

    for (const node of cycleNodes) {
      if (!visited.has(node)) {
        const cycle = dfs(node);
        if (cycle) return cycle;
      }
    }
  }

  return cycleNodes;
}

/**
 * 레벨별 정렬 (같은 레벨의 노드들은 병렬 처리 가능)
 */
export function getLevelOrder(graph: DependencyGraph): SemanticPath[][] {
  const levels: SemanticPath[][] = [];
  const nodeLevel = new Map<SemanticPath, number>();

  // 각 노드의 레벨 계산
  function calculateLevel(path: SemanticPath): number {
    if (nodeLevel.has(path)) {
      return nodeLevel.get(path)!;
    }

    const deps = graph.dependencies.get(path);
    if (!deps || deps.size === 0) {
      nodeLevel.set(path, 0);
      return 0;
    }

    let maxDepLevel = -1;
    for (const dep of deps) {
      if (graph.nodes.has(dep)) {
        maxDepLevel = Math.max(maxDepLevel, calculateLevel(dep));
      }
    }

    const level = maxDepLevel + 1;
    nodeLevel.set(path, level);
    return level;
  }

  for (const path of graph.nodes.keys()) {
    calculateLevel(path);
  }

  // 레벨별로 그룹화
  for (const [path, level] of nodeLevel) {
    while (levels.length <= level) {
      levels.push([]);
    }
    levels[level]!.push(path);
  }

  return levels;
}

/**
 * 역방향 위상 정렬 (리프부터 루트로)
 */
export function reverseTopologicalSort(graph: DependencyGraph): SemanticPath[] {
  return [...graph.topologicalOrder].reverse();
}

/**
 * 부분 그래프의 위상 정렬
 */
export function partialTopologicalSort(
  graph: DependencyGraph,
  paths: SemanticPath[]
): SemanticPath[] {
  const pathSet = new Set(paths);
  return graph.topologicalOrder.filter((p) => pathSet.has(p));
}

/**
 * 변경된 경로들의 영향을 받는 경로들의 위상 정렬된 순서
 */
export function getAffectedOrder(
  graph: DependencyGraph,
  changedPaths: SemanticPath[]
): SemanticPath[] {
  const affected = new Set<SemanticPath>();

  // BFS로 영향받는 모든 경로 수집
  const queue = [...changedPaths];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (affected.has(current)) continue;
    affected.add(current);

    const dependents = graph.dependents.get(current);
    if (dependents) {
      for (const dep of dependents) {
        if (!affected.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  // 위상 정렬 순서로 필터링
  return graph.topologicalOrder.filter((p) => affected.has(p));
}
