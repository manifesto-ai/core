/**
 * @manifesto-ai/agent - Per-Step Prompt Builder
 *
 * JIT 주입 원칙:
 * - System prompt: 불변 프로토콜만 (Iron Laws)
 * - Per-step: 현재 phase Constraints + 스냅샷 핵심 + 최근 오류
 */

import type { Constraints } from '../types/constraints.js';
import type { PatchErrorState } from '../types/errors.js';
import { formatErrorForLLM } from '../types/errors.js';

/**
 * Per-step prompt 입력
 */
export type StepPromptInput<S = unknown> = {
  /** 현재 스냅샷 */
  snapshot: S;
  /** 현재 constraints */
  constraints: Constraints;
  /** 최근 에러 (있는 경우) */
  recentErrors?: PatchErrorState[];
  /** 사용자 지시 (선택) */
  instruction?: string;
};

/**
 * Per-step prompt 옵션
 */
export type StepPromptOptions = {
  /** 스냅샷 JSON 최대 길이 */
  maxSnapshotLength?: number;
  /** 에러 최대 개수 */
  maxErrors?: number;
  /** 스냅샷 필터 (특정 경로만 포함) */
  snapshotFilter?: (snapshot: unknown) => unknown;
};

/**
 * Per-step prompt 빌드
 */
export function buildStepPrompt<S = unknown>(
  input: StepPromptInput<S>,
  options?: StepPromptOptions
): string {
  const { snapshot, constraints, recentErrors, instruction } = input;
  const {
    maxSnapshotLength = 50000,
    maxErrors = 5,
    snapshotFilter,
  } = options ?? {};

  const parts: string[] = [];

  // 1. 현재 스냅샷
  parts.push('## CURRENT SNAPSHOT');
  parts.push('```json');
  const snapshotToShow = snapshotFilter ? snapshotFilter(snapshot) : snapshot;
  let snapshotJson = JSON.stringify(snapshotToShow, null, 2);
  if (snapshotJson.length > maxSnapshotLength) {
    snapshotJson = snapshotJson.slice(0, maxSnapshotLength) + '\n... (truncated)';
  }
  parts.push(snapshotJson);
  parts.push('```');

  // 2. Phase 규칙 (Constraints)
  parts.push('');
  parts.push('## PHASE RULES (Constraints)');
  parts.push(`Phase: ${constraints.phase}`);
  parts.push(`Writable paths: ${constraints.writablePathPrefixes.join(', ')}`);

  if (constraints.typeRules.length > 0) {
    parts.push('');
    parts.push('Type rules:');
    for (const rule of constraints.typeRules) {
      parts.push(`- ${rule.path}: ${rule.type}`);
    }
  }

  if (constraints.invariants.length > 0) {
    parts.push('');
    parts.push('Invariants:');
    for (const inv of constraints.invariants) {
      parts.push(`- [${inv.id}] ${inv.description}`);
    }
  }

  // 3. 최근 에러 (있는 경우)
  if (recentErrors && recentErrors.length > 0) {
    parts.push('');
    parts.push('## RECENT ERRORS');
    parts.push('Your previous effects caused these errors. Please correct:');
    parts.push('```');
    const errorsToShow = recentErrors.slice(0, maxErrors);
    for (const error of errorsToShow) {
      parts.push(formatErrorForLLM(error));
    }
    if (recentErrors.length > maxErrors) {
      parts.push(`... and ${recentErrors.length - maxErrors} more errors`);
    }
    parts.push('```');
  }

  // 4. 사용자 지시
  parts.push('');
  parts.push('## INSTRUCTION');
  if (instruction) {
    parts.push(instruction);
  } else {
    parts.push('Analyze the snapshot and emit appropriate effects to progress the task.');
  }

  // 5. 응답 형식 리마인더
  parts.push('');
  parts.push('Respond with a single JSON object matching AgentDecision schema.');

  return parts.join('\n');
}

/**
 * 스냅샷 요약 생성 (긴 스냅샷용)
 */
export function summarizeSnapshot<S>(
  snapshot: S,
  maxDepth: number = 2
): string {
  return JSON.stringify(summarizeObject(snapshot, maxDepth, 0), null, 2);
}

/**
 * 객체 요약 헬퍼
 */
function summarizeObject(obj: unknown, maxDepth: number, currentDepth: number): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    // 긴 문자열은 자르기
    if (typeof obj === 'string' && obj.length > 100) {
      return obj.slice(0, 100) + '...';
    }
    return obj;
  }

  if (currentDepth >= maxDepth) {
    if (Array.isArray(obj)) {
      return `[Array(${obj.length})]`;
    }
    return '{...}';
  }

  if (Array.isArray(obj)) {
    if (obj.length > 3) {
      return [
        ...obj.slice(0, 3).map((item) => summarizeObject(item, maxDepth, currentDepth + 1)),
        `... (${obj.length - 3} more)`,
      ];
    }
    return obj.map((item) => summarizeObject(item, maxDepth, currentDepth + 1));
  }

  const result: Record<string, unknown> = {};
  const keys = Object.keys(obj);
  for (const key of keys) {
    result[key] = summarizeObject(
      (obj as Record<string, unknown>)[key],
      maxDepth,
      currentDepth + 1
    );
  }
  return result;
}

/**
 * 스냅샷 필터 생성 - 특정 경로만 포함
 */
export function createSnapshotFilter(includePaths: string[]): (snapshot: unknown) => unknown {
  return (snapshot: unknown) => {
    if (typeof snapshot !== 'object' || snapshot === null) {
      return snapshot;
    }

    const result: Record<string, unknown> = {};

    for (const path of includePaths) {
      const parts = path.split('.');
      let source: unknown = snapshot;
      let target: Record<string, unknown> = result;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const isLast = i === parts.length - 1;

        if (source === null || source === undefined || typeof source !== 'object') {
          break;
        }

        if (isLast) {
          target[part] = (source as Record<string, unknown>)[part];
        } else {
          if (!(part in target)) {
            target[part] = {};
          }
          source = (source as Record<string, unknown>)[part];
          target = target[part] as Record<string, unknown>;
        }
      }
    }

    return result;
  };
}

/**
 * 완전한 LLM 메시지 생성 (system + step)
 */
export type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export function buildLLMMessages<S = unknown>(
  systemPrompt: string,
  stepInput: StepPromptInput<S>,
  options?: StepPromptOptions
): LLMMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildStepPrompt(stepInput, options) },
  ];
}
