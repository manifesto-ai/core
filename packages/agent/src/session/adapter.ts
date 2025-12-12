/**
 * @manifesto-ai/agent - Runtime Adapter
 *
 * DomainRuntime(@manifesto-ai/core)을 AgentRuntime으로 래핑하는 어댑터.
 * Agent 실행에 필요한 추가 기능(에러 상태, observations)을 제공.
 */

import type { PatchOp } from '../types/effect.js';
import type { ErrorState, PatchErrorState } from '../types/errors.js';
import type { Observation } from '../types/observation.js';
import type { AgentRuntime, ApplyResult } from '../types/session.js';

/**
 * DomainRuntime 최소 인터페이스
 * @manifesto-ai/core의 DomainRuntime과 호환
 */
export interface DomainRuntimeLike<TData = unknown, TState = unknown> {
  /** 스냅샷 조회 */
  getSnapshot(): {
    data: TData;
    state: TState;
    derived: Record<string, unknown>;
  };
  /** 경로로 값 설정 */
  set(path: string, value: unknown): { ok: boolean; error?: unknown };
  /** 여러 경로로 값 설정 */
  setMany?(updates: Record<string, unknown>): { ok: boolean; error?: unknown };
}

/**
 * AgentRuntime 어댑터 옵션
 */
export type CreateAgentRuntimeOptions<TData, TState> = {
  /** DomainRuntime 인스턴스 */
  domainRuntime: DomainRuntimeLike<TData, TState>;
  /** 에러 저장소 최대 크기 (기본: 100) */
  maxErrors?: number;
  /** Observation 저장소 최대 크기 (기본: 1000) */
  maxObservations?: number;
};

/**
 * DomainRuntime을 AgentRuntime으로 래핑하는 어댑터 생성
 *
 * @example
 * ```ts
 * import { createRuntime } from '@manifesto-ai/core';
 * import { createAgentRuntime, createAgentSession } from '@manifesto-ai/agent';
 *
 * const domainRuntime = createRuntime({ domain: myDomain });
 * const agentRuntime = createAgentRuntime({ domainRuntime });
 *
 * const session = createAgentSession({
 *   runtime: agentRuntime,
 *   client: myClient,
 * });
 * ```
 */
export function createAgentRuntime<TData = unknown, TState = unknown>(
  options: CreateAgentRuntimeOptions<TData, TState>
): AgentRuntime<{ data: TData; state: TState; derived: Record<string, unknown> }> {
  const { domainRuntime, maxErrors = 100, maxObservations = 1000 } = options;

  // 에러 상태 저장소 (Agent 전용)
  const errors: ErrorState[] = [];

  // Observation 저장소 (derived.observations에도 동기화)
  const observations: Observation[] = [];

  type Snapshot = { data: TData; state: TState; derived: Record<string, unknown> };

  return {
    getSnapshot(): Snapshot {
      const snapshot = domainRuntime.getSnapshot();
      // derived.observations 동기화
      return {
        ...snapshot,
        derived: {
          ...snapshot.derived,
          observations: [...observations],
        },
      };
    },

    applyPatch(ops: PatchOp[]): ApplyResult<Snapshot> {
      try {
        for (const op of ops) {
          if (op.op === 'set') {
            const result = domainRuntime.set(op.path, op.value);
            if (!result.ok) {
              return {
                ok: false,
                error: {
                  kind: 'patch_validation_error',
                  at: op.path,
                  issue: 'Invalid operation',
                  advice: 'Set operation failed in domain runtime',
                  effectId: '',
                  ts: Date.now(),
                },
              };
            }
          } else if (op.op === 'append') {
            // append는 배열 가져와서 push 후 set
            const snapshot = domainRuntime.getSnapshot();
            const value = getValueByPath(snapshot, op.path);
            if (!Array.isArray(value)) {
              return {
                ok: false,
                error: {
                  kind: 'patch_validation_error',
                  at: op.path,
                  issue: 'Type mismatch',
                  expected: 'array',
                  got: typeof value,
                  advice: 'Append target must be an array',
                  effectId: '',
                  ts: Date.now(),
                },
              };
            }
            const newArray = [...value, op.value];
            const result = domainRuntime.set(op.path, newArray);
            if (!result.ok) {
              return {
                ok: false,
                error: {
                  kind: 'patch_validation_error',
                  at: op.path,
                  issue: 'Invalid operation',
                  advice: 'Append operation failed in domain runtime',
                  effectId: '',
                  ts: Date.now(),
                },
              };
            }
          }
        }

        return {
          ok: true,
          snapshot: this.getSnapshot(),
        };
      } catch (err) {
        return {
          ok: false,
          error: {
            kind: 'patch_validation_error',
            at: '',
            issue: 'Invalid operation',
            advice: err instanceof Error ? err.message : String(err),
            effectId: '',
            ts: Date.now(),
          },
        };
      }
    },

    appendError(error: ErrorState): void {
      errors.push(error);
      // 최대 크기 초과 시 오래된 것 제거
      if (errors.length > maxErrors) {
        errors.shift();
      }
    },

    getRecentErrors(limit = 5): PatchErrorState[] {
      return errors.slice(-limit) as PatchErrorState[];
    },

    clearErrors(): void {
      errors.length = 0;
    },

    appendObservation(obs: Observation): void {
      observations.push(obs);
      // 최대 크기 초과 시 오래된 것 제거
      if (observations.length > maxObservations) {
        observations.shift();
      }
    },
  };
}

/**
 * 경로로 값 조회 헬퍼
 */
function getValueByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    const index = parseInt(part, 10);
    if (!isNaN(index) && Array.isArray(current)) {
      current = current[index];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}
