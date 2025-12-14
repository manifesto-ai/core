/**
 * @manifesto-ai/agent - Session Factory
 *
 * createAgentSession: 세션 생성 팩토리
 * Session = 여러 step으로 구성된 실행 단위
 */

import type { AgentClient } from '../types/client.js';
import type { Constraints } from '../types/constraints.js';
import type { Policy } from '../types/policy.js';
import type { AgentRuntime, AgentSession, StepResult, RunResult, DoneChecker } from '../types/session.js';
import type { RuntimeEvents } from '../types/events.js';
import type { EffectHandlerRegistry, ToolRegistry } from '../handlers/registry.js';
import type {
  ProjectionProvider,
  CompressionStrategy,
} from '../projection/types.js';
import { createDefaultPolicy } from '../types/policy.js';
import { createDefaultConstraints } from '../types/constraints.js';
import { createToolRegistry, createDefaultHandlerRegistry } from '../handlers/index.js';
import { createSimpleProjectionProvider } from '../projection/provider.js';
import { executeStep, executeRun, type ExecutorContext } from './executor.js';

/**
 * Projection 설정 옵션
 * projectionProvider 대신 간단한 설정으로 projection 사용
 */
export type ProjectionConfig = {
  /** 투영할 경로 목록 */
  paths: string[];
  /** 토큰 예산 (기본: 4000) */
  tokenBudget?: number;
  /** 압축 전략 (기본: 'truncate') */
  compressionStrategy?: CompressionStrategy;
  /** 항상 포함할 경로 */
  requiredPaths?: string[];
  /** 항상 제외할 경로 */
  excludePaths?: string[];
};

/**
 * Session 생성 옵션
 */
export type CreateAgentSessionOptions<S = unknown> = {
  /** AgentRuntime 인터페이스 */
  runtime: AgentRuntime<S>;
  /** AgentClient (LLM 어댑터) */
  client: AgentClient<S>;
  /** 실행 정책 */
  policy?: Partial<Policy>;
  /** Effect 핸들러 레지스트리 */
  handlers?: EffectHandlerRegistry<S>;
  /** Tool 레지스트리 또는 Tool 배열 */
  tools?: ToolRegistry | Array<{ name: string; description: string; execute: (input: unknown) => Promise<unknown> }>;
  /** Constraints 컴파일러 */
  compileConstraints?: (snapshot: S) => Constraints;
  /** 사용자 지시 */
  instruction?: string;
  /** 완료 조건 체커 */
  isDone?: DoneChecker<S>;
  /**
   * Projection Provider (v0.1.x)
   * LLM에게 전달할 스냅샷을 투영하는 제공자
   */
  projectionProvider?: ProjectionProvider<S>;
  /**
   * Projection 설정 (v0.1.x)
   * projectionProvider 대신 간단한 설정으로 projection 사용
   * projectionProvider가 제공되면 무시됨
   */
  projection?: ProjectionConfig;
  /**
   * 런타임 이벤트 콜백 (v0.1.x)
   * Step, LLM 호출, Effect 실행 등의 진행 상황 알림
   */
  events?: RuntimeEvents<S>;
};

/**
 * AgentSession 생성
 *
 * @param opts - 세션 생성 옵션
 * @returns AgentSession
 *
 * @example
 * ```ts
 * const session = createAgentSession({
 *   runtime: myRuntime,
 *   client: myLLMClient,
 *   policy: { maxSteps: 50 },
 *   tools: [searchTool, calculatorTool],
 *   compileConstraints: (snapshot) => ({
 *     phase: snapshot.state.phase,
 *     writablePathPrefixes: ['data.', 'state.'],
 *     typeRules: [],
 *     invariants: [],
 *   }),
 * });
 *
 * // 단일 step 실행
 * const stepResult = await session.step();
 *
 * // 완료될 때까지 실행
 * const runResult = await session.run();
 * ```
 */
export function createAgentSession<S = unknown>(
  opts: CreateAgentSessionOptions<S>
): AgentSession {
  const {
    runtime,
    client,
    policy: policyOverride,
    handlers,
    tools: toolsInput,
    compileConstraints: compileConstraintsInput,
    instruction,
    isDone,
    projectionProvider: projectionProviderInput,
    projection,
    events,
  } = opts;

  // Policy 병합
  const policy: Policy = {
    ...createDefaultPolicy(),
    ...policyOverride,
  };

  // Tools 설정
  const tools: ToolRegistry = toolsInput
    ? (Array.isArray(toolsInput) ? createToolRegistry(toolsInput) : toolsInput)
    : createToolRegistry([]);

  // Handlers 설정
  const effectHandlers = handlers ?? createDefaultHandlerRegistry<S>();

  // Constraints 컴파일러 (기본: 단순 기본값)
  const compileConstraints = compileConstraintsInput ?? (() => createDefaultConstraints());

  // Projection Provider 설정
  // projectionProvider가 직접 제공되면 사용, 아니면 projection 설정으로 생성
  let projectionProvider: ProjectionProvider<S> | undefined = projectionProviderInput;
  if (!projectionProvider && projection) {
    projectionProvider = createSimpleProjectionProvider<S>({
      paths: projection.paths,
      config: {
        tokenBudget: projection.tokenBudget,
        compressionStrategy: projection.compressionStrategy,
        requiredPaths: projection.requiredPaths,
        excludePaths: projection.excludePaths,
      },
    });
  }

  // Executor 컨텍스트
  const ctx: ExecutorContext<S> = {
    runtime,
    client,
    policy,
    handlers: effectHandlers,
    tools,
    compileConstraints,
    instruction,
    projectionProvider,
    events,
  };

  return {
    async step(): Promise<StepResult> {
      return executeStep(ctx);
    },

    async run(): Promise<RunResult> {
      return executeRun(ctx, isDone);
    },
  };
}

/**
 * 간단한 세션 생성 헬퍼
 * Core의 최소 구현체와 함께 사용
 */
export type SimpleSessionOptions<S> = {
  /** 초기 스냅샷 */
  initialSnapshot: S;
  /** AgentClient */
  client: AgentClient<S>;
  /** 실행 정책 */
  policy?: Partial<Policy>;
  /** Tools */
  tools?: Array<{ name: string; description: string; execute: (input: unknown) => Promise<unknown> }>;
  /** Constraints 컴파일러 */
  compileConstraints?: (snapshot: S) => Constraints;
  /** 사용자 지시 */
  instruction?: string;
  /** 완료 조건 */
  isDone?: DoneChecker<S>;
};

/**
 * 간단한 in-memory Core 구현과 함께 세션 생성
 */
export function createSimpleSession<S>(opts: SimpleSessionOptions<S>): {
  session: AgentSession;
  getSnapshot: () => S;
  getErrors: () => unknown[];
  getObservations: () => unknown[];
} {
  const { initialSnapshot, client, policy, tools, compileConstraints, instruction, isDone } = opts;

  // In-memory state
  let snapshot = deepClone(initialSnapshot);
  const errors: unknown[] = [];
  const observations: unknown[] = [];

  // AgentRuntime 구현
  const runtime: AgentRuntime<S> = {
    getSnapshot: () => snapshot,

    applyPatch: (ops) => {
      try {
        let newSnapshot = deepClone(snapshot);
        for (const op of ops) {
          newSnapshot = applyOp(newSnapshot, op) as S;
        }
        snapshot = newSnapshot;
        return { ok: true, snapshot };
      } catch (err) {
        return {
          ok: false,
          error: {
            kind: 'patch_validation_error',
            at: '',
            issue: 'Invalid operation',
            effectId: '',
            ts: Date.now(),
          },
        };
      }
    },

    appendError: (error) => {
      errors.push(error);
    },

    getRecentErrors: (limit = 5) => {
      return errors.slice(-limit) as any;
    },

    clearErrors: () => {
      errors.length = 0;
    },

    appendObservation: (obs) => {
      observations.push(obs);
      // derived.observations에 추가
      if (typeof snapshot === 'object' && snapshot !== null) {
        const s = snapshot as Record<string, unknown>;
        if (!s.derived) {
          s.derived = {};
        }
        const derived = s.derived as Record<string, unknown>;
        if (!Array.isArray(derived.observations)) {
          derived.observations = [];
        }
        (derived.observations as unknown[]).push(obs);
      }
    },
  };

  const session = createAgentSession({
    runtime,
    client,
    policy,
    tools,
    compileConstraints,
    instruction,
    isDone,
  });

  return {
    session,
    getSnapshot: () => snapshot,
    getErrors: () => [...errors],
    getObservations: () => [...observations],
  };
}

/**
 * Deep clone 헬퍼
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = deepClone(value);
  }

  return result as T;
}

/**
 * PatchOp 적용 헬퍼
 */
function applyOp<T>(obj: T, op: { op: string; path: string; value: unknown }): T {
  const result = deepClone(obj);
  const path = op.path.split('.');

  let current: unknown = result;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const index = parseInt(key, 10);

    if (!isNaN(index) && Array.isArray(current)) {
      if (current[index] === undefined) {
        current[index] = {};
      }
      current = current[index];
    } else if (typeof current === 'object' && current !== null) {
      const rec = current as Record<string, unknown>;
      if (rec[key] === undefined) {
        rec[key] = {};
      }
      current = rec[key];
    }
  }

  const lastKey = path[path.length - 1]!;
  const lastIndex = parseInt(lastKey, 10);

  if (typeof current === 'object' && current !== null) {
    if (op.op === 'set') {
      if (!isNaN(lastIndex) && Array.isArray(current)) {
        current[lastIndex] = op.value;
      } else {
        (current as Record<string, unknown>)[lastKey] = op.value;
      }
    } else if (op.op === 'append') {
      const arr = !isNaN(lastIndex) && Array.isArray(current)
        ? current[lastIndex]
        : (current as Record<string, unknown>)[lastKey];

      if (Array.isArray(arr)) {
        arr.push(op.value);
      }
    }
  }

  return result;
}
