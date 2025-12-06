/**
 * DAG (Directed Acyclic Graph) for Dependency Tracking
 *
 * 필드 간 의존성을 추적하고 순환 참조를 탐지
 */

import { ok, err, type Result } from '@manifesto-ai/schema'

// ============================================================================
// Types
// ============================================================================

export interface DependencyNode {
  readonly id: string
  readonly dependencies: ReadonlySet<string>
  readonly dependents: ReadonlySet<string>
}

export interface CycleError {
  type: 'CYCLE_DETECTED'
  cycle: string[]
  message: string
}

export interface DependencyGraph {
  readonly nodes: ReadonlyMap<string, DependencyNode>
}

// ============================================================================
// DAG Implementation
// ============================================================================

export class DependencyTracker {
  private nodes: Map<string, Set<string>> = new Map() // id -> dependencies
  private reverseNodes: Map<string, Set<string>> = new Map() // id -> dependents

  /** 재귀 깊이 제한 (스택 오버플로우 방지) */
  private static readonly MAX_DEPTH = 1000

  /** 위상 정렬 캐싱 */
  private cachedTopologicalOrder: string[] | null = null
  private isDirty = true

  /** 캐시 무효화 */
  private invalidateCache(): void {
    this.cachedTopologicalOrder = null
    this.isDirty = true
  }

  /**
   * 노드 추가 (의존성 없이)
   */
  addNode(id: string): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, new Set())
      this.reverseNodes.set(id, new Set())
      this.invalidateCache()
    }
  }

  /**
   * 의존성 추가
   *
   * @param id - 현재 노드
   * @param dependsOn - 의존하는 노드들
   */
  addDependencies(id: string, dependsOn: string[]): Result<void, CycleError> {
    this.addNode(id)

    for (const dep of dependsOn) {
      this.addNode(dep)

      // 순환 참조 체크
      const cycleCheck = this.wouldCreateCycle(id, dep)
      if (cycleCheck._tag === 'Err') {
        return cycleCheck
      }

      // 의존성 추가
      this.nodes.get(id)!.add(dep)
      this.reverseNodes.get(dep)!.add(id)
      this.invalidateCache()
    }

    return ok(undefined)
  }

  /**
   * 노드의 모든 의존성 반환 (직접 의존성만)
   */
  getDependencies(id: string): ReadonlySet<string> {
    return this.nodes.get(id) ?? new Set()
  }

  /**
   * 노드에 의존하는 모든 노드 반환 (직접 의존자만)
   */
  getDependents(id: string): ReadonlySet<string> {
    return this.reverseNodes.get(id) ?? new Set()
  }

  /**
   * 모든 의존성 반환 (재귀적으로 수집)
   */
  getAllDependencies(id: string): Set<string> {
    const result = new Set<string>()
    const visited = new Set<string>()

    const collect = (nodeId: string, depth: number) => {
      if (visited.has(nodeId)) return
      if (depth > DependencyTracker.MAX_DEPTH) {
        console.warn(`[DAG] Max dependency depth (${DependencyTracker.MAX_DEPTH}) exceeded for node: ${id}`)
        return
      }
      visited.add(nodeId)

      const deps = this.nodes.get(nodeId)
      if (deps) {
        for (const dep of deps) {
          result.add(dep)
          collect(dep, depth + 1)
        }
      }
    }

    collect(id, 0)
    return result
  }

  /**
   * 영향받는 모든 노드 반환 (재귀적으로 수집)
   *
   * 특정 노드가 변경되었을 때 재평가가 필요한 노드들
   */
  getAffectedNodes(id: string): Set<string> {
    const result = new Set<string>()
    const visited = new Set<string>()

    const collect = (nodeId: string, depth: number) => {
      if (visited.has(nodeId)) return
      if (depth > DependencyTracker.MAX_DEPTH) {
        console.warn(`[DAG] Max affected depth (${DependencyTracker.MAX_DEPTH}) exceeded for node: ${id}`)
        return
      }
      visited.add(nodeId)

      const dependents = this.reverseNodes.get(nodeId)
      if (dependents) {
        for (const dep of dependents) {
          result.add(dep)
          collect(dep, depth + 1)
        }
      }
    }

    collect(id, 0)
    return result
  }

  /**
   * 위상 정렬 (Topological Sort)
   *
   * 의존성 순서대로 노드 정렬
   * 캐싱을 통해 그래프가 변경되지 않았으면 이전 결과를 재사용
   */
  topologicalSort(): Result<string[], CycleError> {
    // 캐시된 결과가 있고 그래프가 변경되지 않았으면 재사용
    if (!this.isDirty && this.cachedTopologicalOrder !== null) {
      return ok([...this.cachedTopologicalOrder])
    }

    const visited = new Set<string>()
    const temp = new Set<string>()
    const result: string[] = []
    const path: string[] = [] // 재사용 가능한 경로 배열

    const visit = (nodeId: string, depth: number): Result<void, CycleError> => {
      if (temp.has(nodeId)) {
        // cycle 경로 재구성: path에서 nodeId가 처음 나타난 위치부터
        const cycleStart = path.indexOf(nodeId)
        const cycle = cycleStart >= 0
          ? [...path.slice(cycleStart), nodeId]
          : [nodeId] // fallback
        return err({
          type: 'CYCLE_DETECTED',
          cycle,
          message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        })
      }

      if (visited.has(nodeId)) {
        return ok(undefined)
      }

      // 깊이 제한 체크
      if (depth > DependencyTracker.MAX_DEPTH) {
        console.warn(`[DAG] Max topological sort depth (${DependencyTracker.MAX_DEPTH}) exceeded`)
        return ok(undefined) // graceful degradation
      }

      temp.add(nodeId)
      path.push(nodeId)

      const deps = this.nodes.get(nodeId) ?? new Set()
      for (const dep of deps) {
        const res = visit(dep, depth + 1)
        if (res._tag === 'Err') return res
      }

      path.pop()
      temp.delete(nodeId)
      visited.add(nodeId)
      result.push(nodeId)

      return ok(undefined)
    }

    for (const nodeId of this.nodes.keys()) {
      const res = visit(nodeId, 0)
      if (res._tag === 'Err') return res
    }

    // 결과 캐싱
    this.cachedTopologicalOrder = [...result]
    this.isDirty = false

    return ok(result)
  }

  /**
   * 특정 노드들에 대한 평가 순서 계산
   */
  getEvaluationOrder(nodeIds: string[]): Result<string[], CycleError> {
    // 관련된 노드만 포함하는 서브그래프에서 위상 정렬
    const relevant = new Set(nodeIds)

    // 의존성도 포함
    for (const id of nodeIds) {
      const allDeps = this.getAllDependencies(id)
      for (const dep of allDeps) {
        relevant.add(dep)
      }
    }

    const sortResult = this.topologicalSort()
    if (sortResult._tag === 'Err') return sortResult

    // 관련된 노드만 필터링하면서 순서 유지
    return ok(sortResult.value.filter((id) => relevant.has(id)))
  }

  /**
   * 순환 참조가 발생하는지 미리 체크
   */
  private wouldCreateCycle(from: string, to: string): Result<void, CycleError> {
    // from -> to 엣지를 추가했을 때
    // to에서 from으로 도달 가능하면 순환
    const visited = new Set<string>()
    const path: string[] = []

    const canReach = (current: string, depth: number): string[] | null => {
      if (current === from) {
        return [...path, current]
      }
      if (visited.has(current)) {
        return null
      }
      if (depth > DependencyTracker.MAX_DEPTH) {
        console.warn(`[DAG] Max cycle check depth (${DependencyTracker.MAX_DEPTH}) exceeded`)
        return null
      }

      visited.add(current)
      path.push(current)

      const deps = this.nodes.get(current) ?? new Set()
      for (const dep of deps) {
        const result = canReach(dep, depth + 1)
        if (result) return result
      }

      path.pop()
      return null
    }

    const cyclePath = canReach(to, 0)
    if (cyclePath) {
      return err({
        type: 'CYCLE_DETECTED',
        cycle: [from, ...cyclePath],
        message: `Adding dependency ${from} -> ${to} would create cycle: ${[from, ...cyclePath].join(' -> ')}`,
      })
    }

    return ok(undefined)
  }

  /**
   * 그래프 상태 내보내기
   */
  export(): DependencyGraph {
    const nodes = new Map<string, DependencyNode>()

    for (const [id, deps] of this.nodes) {
      nodes.set(id, {
        id,
        dependencies: new Set(deps),
        dependents: new Set(this.reverseNodes.get(id) ?? []),
      })
    }

    return { nodes }
  }

  /**
   * 그래프 초기화
   */
  clear(): void {
    this.nodes.clear()
    this.reverseNodes.clear()
    this.invalidateCache()
  }

  /**
   * 노드 제거
   */
  removeNode(id: string): void {
    // 이 노드를 의존하는 다른 노드들에서 제거
    const dependents = this.reverseNodes.get(id)
    if (dependents) {
      for (const dep of dependents) {
        this.nodes.get(dep)?.delete(id)
      }
    }

    // 이 노드가 의존하는 노드들의 역참조에서 제거
    const dependencies = this.nodes.get(id)
    if (dependencies) {
      for (const dep of dependencies) {
        this.reverseNodes.get(dep)?.delete(id)
      }
    }

    this.nodes.delete(id)
    this.reverseNodes.delete(id)
    this.invalidateCache()
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createDependencyTracker = (): DependencyTracker => {
  return new DependencyTracker()
}
