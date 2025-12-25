/**
 * Pass Registry - Pass 등록 및 실행 순서 관리
 *
 * Topological sort 기반으로 Pass 의존성을 해결하고,
 * 올바른 순서로 Pass를 실행합니다.
 */

import type { Artifact, SelectionSpan } from '../types/artifact.js';
import type { Fragment } from '../types/fragment.js';
import type { FragmentDraft } from '../types/fragment-draft.js';
import type {
  Pass,
  NLPass,
  PassContext,
  PassResult,
  Finding,
} from './base.js';
import { isNLPass, createPassContext, createFindingId } from './base.js';

// ============================================================================
// Pass Registration
// ============================================================================

/**
 * 등록된 Pass 정보
 */
interface RegisteredPass {
  pass: Pass | NLPass;
  enabled: boolean;
}

/**
 * PassRegistry - Pass 등록 및 실행 관리
 */
export class PassRegistry {
  private passes: Map<string, RegisteredPass> = new Map();
  private sortedPasses: (Pass | NLPass)[] | null = null;

  /**
   * Pass 등록
   */
  register(pass: Pass | NLPass): this {
    if (this.passes.has(pass.name)) {
      throw new Error(`Pass "${pass.name}" is already registered`);
    }

    this.passes.set(pass.name, { pass, enabled: true });
    this.sortedPasses = null; // Invalidate cache
    return this;
  }

  /**
   * 여러 Pass 등록
   */
  registerAll(passes: (Pass | NLPass)[]): this {
    for (const pass of passes) {
      this.register(pass);
    }
    return this;
  }

  /**
   * Pass 활성화/비활성화
   */
  setEnabled(passName: string, enabled: boolean): this {
    const registered = this.passes.get(passName);
    if (!registered) {
      throw new Error(`Pass "${passName}" is not registered`);
    }
    registered.enabled = enabled;
    return this;
  }

  /**
   * Pass 가져오기
   */
  getPass(name: string): Pass | NLPass | undefined {
    return this.passes.get(name)?.pass;
  }

  /**
   * 모든 Pass 가져오기
   */
  getAllPasses(): (Pass | NLPass)[] {
    return Array.from(this.passes.values()).map((r) => r.pass);
  }

  /**
   * 활성화된 Pass만 가져오기
   */
  getEnabledPasses(): (Pass | NLPass)[] {
    return Array.from(this.passes.values())
      .filter((r) => r.enabled)
      .map((r) => r.pass);
  }

  /**
   * 실행 순서대로 정렬된 Pass 가져오기
   *
   * Topological sort + priority 기반 정렬
   */
  getSortedPasses(): (Pass | NLPass)[] {
    if (this.sortedPasses !== null) {
      return this.sortedPasses;
    }

    const enabledPasses = this.getEnabledPasses();
    this.sortedPasses = this.topologicalSort(enabledPasses);
    return this.sortedPasses;
  }

  /**
   * Topological sort with priority
   */
  private topologicalSort(passes: (Pass | NLPass)[]): (Pass | NLPass)[] {
    const passMap = new Map<string, Pass | NLPass>();
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    // Initialize
    for (const pass of passes) {
      passMap.set(pass.name, pass);
      inDegree.set(pass.name, 0);
      graph.set(pass.name, []);
    }

    // Build graph
    for (const pass of passes) {
      if (pass.dependsOn) {
        for (const dep of pass.dependsOn) {
          if (passMap.has(dep)) {
            graph.get(dep)!.push(pass.name);
            inDegree.set(pass.name, (inDegree.get(pass.name) ?? 0) + 1);
          }
        }
      }
    }

    // Kahn's algorithm with priority queue
    const result: (Pass | NLPass)[] = [];
    const queue: (Pass | NLPass)[] = [];

    // Start with passes that have no dependencies
    for (const pass of passes) {
      if (inDegree.get(pass.name) === 0) {
        queue.push(pass);
      }
    }

    // Sort queue by priority
    queue.sort((a, b) => a.priority - b.priority);

    while (queue.length > 0) {
      // Get the pass with highest priority (lowest number)
      const current = queue.shift()!;
      result.push(current);

      // Update neighbors
      const neighbors = graph.get(current.name) ?? [];
      for (const neighborName of neighbors) {
        const newDegree = (inDegree.get(neighborName) ?? 1) - 1;
        inDegree.set(neighborName, newDegree);

        if (newDegree === 0) {
          const neighbor = passMap.get(neighborName)!;
          queue.push(neighbor);
          // Re-sort by priority
          queue.sort((a, b) => a.priority - b.priority);
        }
      }
    }

    // Check for cycles
    if (result.length !== passes.length) {
      const remaining = passes.filter((p) => !result.includes(p));
      const remainingNames = remaining.map((p) => p.name).join(', ');
      throw new Error(
        `Cyclic dependency detected in passes: ${remainingNames}. ` +
          'Check the dependsOn configuration.'
      );
    }

    return result;
  }

  /**
   * Artifact에 대해 지원하는 Pass 가져오기
   */
  getSupportingPasses(artifact: Artifact): (Pass | NLPass)[] {
    return this.getSortedPasses().filter((pass) => pass.supports(artifact));
  }
}

// ============================================================================
// Pass Executor
// ============================================================================

/**
 * Pass 실행 옵션
 */
export interface ExecutePassOptions {
  /** 부분 컴파일 영역 */
  selection?: SelectionSpan;
  /** 기존 Fragment */
  existingFragments?: Fragment[];
  /** 기존 Semantic Path */
  existingPaths?: string[];
  /** 로거 */
  logger?: (level: string, message: string, data?: unknown) => void;
  /** 실행 이벤트 콜백 */
  onPassStart?: (passName: string) => void;
  onPassComplete?: (result: PassResult) => void;
}

/**
 * Pass 실행 결과 집계
 */
export interface ExecuteResult {
  /** 모든 Pass 결과 */
  passResults: PassResult[];
  /** 모든 Finding */
  findings: Finding[];
  /** 모든 Fragment */
  fragments: Fragment[];
  /** 모든 Draft (NL Pass) */
  drafts: FragmentDraft[];
  /** 총 실행 시간 (ms) */
  totalDuration: number;
  /** 오류 목록 */
  errors: Array<{ passName: string; error: Error }>;
}

/**
 * PassExecutor - Pass 실행 관리
 */
export class PassExecutor {
  constructor(private registry: PassRegistry) {}

  /**
   * Artifact에 대해 모든 Pass 실행
   */
  async execute(artifact: Artifact, options: ExecutePassOptions = {}): Promise<ExecuteResult> {
    const startTime = Date.now();
    const supportingPasses = this.registry.getSupportingPasses(artifact);

    const passResults: PassResult[] = [];
    const allFindings: Finding[] = [];
    const allFragments: Fragment[] = [];
    const allDrafts: FragmentDraft[] = [];
    const errors: Array<{ passName: string; error: Error }> = [];

    // Execute passes in order
    for (const pass of supportingPasses) {
      const ctx = this.createContext(artifact, {
        ...options,
        previousFindings: allFindings,
        existingFragments: [...(options.existingFragments ?? []), ...allFragments],
      });

      options.onPassStart?.(pass.name);

      const result = await this.executePass(pass, ctx);
      passResults.push(result);

      if (result.error) {
        errors.push({ passName: pass.name, error: result.error });
      } else {
        allFindings.push(...result.findings);
        allFragments.push(...result.fragments);
        if (result.drafts) {
          allDrafts.push(...result.drafts);
        }
      }

      options.onPassComplete?.(result);
    }

    return {
      passResults,
      findings: allFindings,
      fragments: allFragments,
      drafts: allDrafts,
      totalDuration: Date.now() - startTime,
      errors,
    };
  }

  /**
   * 단일 Pass 실행
   */
  private async executePass(pass: Pass | NLPass, ctx: PassContext): Promise<PassResult> {
    const startTime = Date.now();
    const result: PassResult = {
      passName: pass.name,
      findings: [],
      fragments: [],
      duration: 0,
    };

    try {
      // Analyze phase
      result.findings = pass.analyze(ctx);

      // Update finding with pass name
      for (const finding of result.findings) {
        finding.passName = pass.name;
        if (!finding.id) {
          finding.id = createFindingId(pass.name);
        }
      }

      // Compile phase
      if (isNLPass(pass)) {
        // NL Pass returns drafts (async)
        result.drafts = await pass.compile(result.findings, ctx);
      } else {
        // Regular Pass returns fragments
        result.fragments = pass.compile(result.findings, ctx);
      }
    } catch (error) {
      result.error = error instanceof Error ? error : new Error(String(error));
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * PassContext 생성
   */
  private createContext(
    artifact: Artifact,
    options: ExecutePassOptions & { previousFindings?: Finding[] }
  ): PassContext {
    return createPassContext(artifact, {
      selection: options.selection,
      previousFindings: options.previousFindings,
      existingFragments: options.existingFragments,
      existingPaths: options.existingPaths,
      logger: options.logger,
    });
  }
}

// ============================================================================
// Default Registry
// ============================================================================

/**
 * 기본 PassRegistry 생성
 */
export function createPassRegistry(): PassRegistry {
  return new PassRegistry();
}

/**
 * PassExecutor 생성
 */
export function createPassExecutor(registry: PassRegistry): PassExecutor {
  return new PassExecutor(registry);
}
