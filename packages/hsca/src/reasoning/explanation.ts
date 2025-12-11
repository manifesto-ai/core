/**
 * Explanation Generator for HSCA
 *
 * "왜 모르는지" 설명을 생성하는 유틸리티
 *
 * Explainable Ignorance의 핵심:
 * - reasoningPath를 기반으로 검색 시도 내역 설명
 * - 최고 관련성, 임계값, 시도 횟수 등 정량적 근거 제시
 */

import type { ReasoningStep, Conclusion } from './types.js';
import { DEFAULT_DERIVED_CONFIG, type DerivedConfig } from './derived.js';

// ═══════════════════════════════════════════════════════
// 설명 생성 설정
// ═══════════════════════════════════════════════════════

/**
 * 설명 생성 설정
 */
export type ExplanationConfig = {
  /** 관련성 표시 형식 (percent | decimal) */
  relevanceFormat: 'percent' | 'decimal';

  /** 언어 (ko | en) */
  language: 'ko' | 'en';

  /** 임계값 (설명에 표시용) */
  relevanceThreshold: number;
};

export const DEFAULT_EXPLANATION_CONFIG: ExplanationConfig = {
  relevanceFormat: 'percent',
  language: 'ko',
  relevanceThreshold: DEFAULT_DERIVED_CONFIG.relevanceThreshold,
};

// ═══════════════════════════════════════════════════════
// 유틸리티 함수
// ═══════════════════════════════════════════════════════

/**
 * 관련성 점수 포맷
 */
function formatRelevance(relevance: number, format: 'percent' | 'decimal'): string {
  if (format === 'percent') {
    return `${(relevance * 100).toFixed(1)}%`;
  }
  return relevance.toFixed(3);
}

/**
 * 검색/확장 시도 필터링
 */
function getAttemptSteps(reasoningPath: ReasoningStep[]): ReasoningStep[] {
  return reasoningPath.filter((step) => step.type === 'retrieve' || step.type === 'expand');
}

// ═══════════════════════════════════════════════════════
// "왜 모르는지" 설명 생성
// ═══════════════════════════════════════════════════════

/**
 * "왜 모르는지" 설명 생성
 *
 * @param reasoningPath - 추론 경로
 * @param config - 설명 설정
 * @returns 설명 문자열
 *
 * @example
 * ```typescript
 * const explanation = buildNotFoundExplanation(state.reasoningPath);
 * // 출력:
 * // 요청하신 정보를 찾을 수 없습니다.
 * //
 * // 검색 시도 내역:
 * // - finance.revenue: 관련성 12.0% (no_match)
 * // - finance.*: 관련성 15.0% (no_relevant_children)
 * //
 * // 요약:
 * // - 검색 범위: finance.revenue, finance.*
 * // - 최고 관련성: 15.0% (임계값 30.0% 미달)
 * // - 총 시도 횟수: 2회
 * ```
 */
export function buildNotFoundExplanation(
  reasoningPath: ReasoningStep[],
  config: Partial<ExplanationConfig> = {}
): string {
  const mergedConfig = { ...DEFAULT_EXPLANATION_CONFIG, ...config };
  const attempts = getAttemptSteps(reasoningPath);

  if (attempts.length === 0) {
    return mergedConfig.language === 'ko'
      ? '검색 시도가 없습니다.'
      : 'No search attempts were made.';
  }

  const maxRelevance = Math.max(...attempts.map((a) => a.relevance));
  const searchedTargets = [...new Set(attempts.map((a) => a.target))];
  const threshold = mergedConfig.relevanceThreshold;

  if (mergedConfig.language === 'ko') {
    const lines: string[] = [
      '요청하신 정보를 찾을 수 없습니다.',
      '',
      '검색 시도 내역:',
    ];

    for (const attempt of attempts) {
      const relevanceStr = formatRelevance(attempt.relevance, mergedConfig.relevanceFormat);
      lines.push(`- ${attempt.target}: 관련성 ${relevanceStr} (${attempt.result})`);
    }

    lines.push('');
    lines.push('요약:');
    lines.push(`- 검색 범위: ${searchedTargets.join(', ')}`);
    lines.push(
      `- 최고 관련성: ${formatRelevance(maxRelevance, mergedConfig.relevanceFormat)} (임계값 ${formatRelevance(threshold, mergedConfig.relevanceFormat)} 미달)`
    );
    lines.push(`- 총 시도 횟수: ${attempts.length}회`);

    return lines.join('\n');
  }

  // English
  const lines: string[] = [
    'The requested information could not be found.',
    '',
    'Search attempts:',
  ];

  for (const attempt of attempts) {
    const relevanceStr = formatRelevance(attempt.relevance, mergedConfig.relevanceFormat);
    lines.push(`- ${attempt.target}: relevance ${relevanceStr} (${attempt.result})`);
  }

  lines.push('');
  lines.push('Summary:');
  lines.push(`- Search scope: ${searchedTargets.join(', ')}`);
  lines.push(
    `- Max relevance: ${formatRelevance(maxRelevance, mergedConfig.relevanceFormat)} (below threshold ${formatRelevance(threshold, mergedConfig.relevanceFormat)})`
  );
  lines.push(`- Total attempts: ${attempts.length}`);

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════
// 결론 설명 생성
// ═══════════════════════════════════════════════════════

/**
 * 결론에 대한 전체 설명 생성
 *
 * @param conclusion - 결론
 * @param reasoningPath - 추론 경로
 * @param config - 설명 설정
 * @returns 설명 문자열
 */
export function buildConclusionExplanation(
  conclusion: Conclusion,
  reasoningPath: ReasoningStep[],
  config: Partial<ExplanationConfig> = {}
): string {
  const mergedConfig = { ...DEFAULT_EXPLANATION_CONFIG, ...config };

  switch (conclusion.type) {
    case 'not_found':
      return buildNotFoundExplanation(reasoningPath, mergedConfig);

    case 'answer': {
      const lines: string[] = [];

      if (mergedConfig.language === 'ko') {
        lines.push('답변:');
        lines.push(conclusion.content);
        lines.push('');
        lines.push(
          `신뢰도: ${formatRelevance(conclusion.confidence, mergedConfig.relevanceFormat)}`
        );
        lines.push(`근거: ${conclusion.evidencePaths.join(', ')}`);
      } else {
        lines.push('Answer:');
        lines.push(conclusion.content);
        lines.push('');
        lines.push(
          `Confidence: ${formatRelevance(conclusion.confidence, mergedConfig.relevanceFormat)}`
        );
        lines.push(`Evidence: ${conclusion.evidencePaths.join(', ')}`);
      }

      return lines.join('\n');
    }

    case 'uncertain': {
      const lines: string[] = [];

      if (mergedConfig.language === 'ko') {
        lines.push('불확실한 결과:');
        lines.push(conclusion.content);
        lines.push('');
        lines.push(
          `신뢰도: ${formatRelevance(conclusion.confidence, mergedConfig.relevanceFormat)}`
        );
        lines.push('추가 정보가 필요할 수 있습니다.');
      } else {
        lines.push('Uncertain result:');
        lines.push(conclusion.content);
        lines.push('');
        lines.push(
          `Confidence: ${formatRelevance(conclusion.confidence, mergedConfig.relevanceFormat)}`
        );
        lines.push('Additional information may be needed.');
      }

      return lines.join('\n');
    }

    default:
      return '';
  }
}

// ═══════════════════════════════════════════════════════
// 추론 경로 포맷
// ═══════════════════════════════════════════════════════

/**
 * 추론 경로를 마크다운 형식으로 포맷
 *
 * @param reasoningPath - 추론 경로
 * @param config - 설명 설정
 * @returns 마크다운 문자열
 *
 * @example
 * ```typescript
 * const markdown = formatReasoningPath(state.reasoningPath);
 * // 출력:
 * // ## 추론 경로
 * //
 * // | Step | Type | Target | Relevance | Result |
 * // |------|------|--------|-----------|--------|
 * // | 1 | retrieve | finance.revenue | 12.0% | no_match |
 * // | 2 | expand | finance.* | 15.0% | no_relevant_children |
 * ```
 */
export function formatReasoningPath(
  reasoningPath: ReasoningStep[],
  config: Partial<ExplanationConfig> = {}
): string {
  const mergedConfig = { ...DEFAULT_EXPLANATION_CONFIG, ...config };

  if (reasoningPath.length === 0) {
    return mergedConfig.language === 'ko' ? '추론 경로가 없습니다.' : 'No reasoning path.';
  }

  const lines: string[] = [];

  if (mergedConfig.language === 'ko') {
    lines.push('## 추론 경로');
    lines.push('');
    lines.push('| 단계 | 타입 | 대상 | 관련성 | 결과 |');
    lines.push('|------|------|------|--------|------|');
  } else {
    lines.push('## Reasoning Path');
    lines.push('');
    lines.push('| Step | Type | Target | Relevance | Result |');
    lines.push('|------|------|--------|-----------|--------|');
  }

  for (const step of reasoningPath) {
    const relevanceStr = formatRelevance(step.relevance, mergedConfig.relevanceFormat);
    lines.push(`| ${step.step} | ${step.type} | ${step.target} | ${relevanceStr} | ${step.result} |`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════
// 간단한 요약 생성
// ═══════════════════════════════════════════════════════

/**
 * 추론 요약 (한 줄)
 *
 * @param reasoningPath - 추론 경로
 * @param config - 설명 설정
 * @returns 요약 문자열
 *
 * @example
 * ```typescript
 * const summary = summarizeReasoning(state.reasoningPath);
 * // "2회 시도, 최고 관련성 15.0%, 정보 없음"
 * ```
 */
export function summarizeReasoning(
  reasoningPath: ReasoningStep[],
  config: Partial<ExplanationConfig> = {}
): string {
  const mergedConfig = { ...DEFAULT_EXPLANATION_CONFIG, ...config };
  const attempts = getAttemptSteps(reasoningPath);

  if (attempts.length === 0) {
    return mergedConfig.language === 'ko' ? '시도 없음' : 'No attempts';
  }

  const maxRelevance = Math.max(...attempts.map((a) => a.relevance));
  const lastStep = reasoningPath[reasoningPath.length - 1];

  if (mergedConfig.language === 'ko') {
    const resultText =
      lastStep?.type === 'not_found'
        ? '정보 없음'
        : lastStep?.type === 'conclude'
          ? '결론 도출'
          : '진행 중';

    return `${attempts.length}회 시도, 최고 관련성 ${formatRelevance(maxRelevance, mergedConfig.relevanceFormat)}, ${resultText}`;
  }

  const resultText =
    lastStep?.type === 'not_found'
      ? 'not found'
      : lastStep?.type === 'conclude'
        ? 'concluded'
        : 'in progress';

  return `${attempts.length} attempts, max relevance ${formatRelevance(maxRelevance, mergedConfig.relevanceFormat)}, ${resultText}`;
}

// ═══════════════════════════════════════════════════════
// JSON 형식 설명
// ═══════════════════════════════════════════════════════

/**
 * 설명을 구조화된 JSON 객체로 생성
 *
 * @param conclusion - 결론
 * @param reasoningPath - 추론 경로
 * @returns 구조화된 설명 객체
 */
export type StructuredExplanation = {
  conclusionType: Conclusion['type'];
  content: string;
  confidence: number;
  attempts: {
    count: number;
    maxRelevance: number;
    targets: string[];
  };
  evidencePaths: string[];
  reasoningSteps: Array<{
    step: number;
    type: string;
    target: string;
    relevance: number;
    result: string;
  }>;
};

export function buildStructuredExplanation(
  conclusion: Conclusion,
  reasoningPath: ReasoningStep[]
): StructuredExplanation {
  const attempts = getAttemptSteps(reasoningPath);

  return {
    conclusionType: conclusion.type,
    content: conclusion.content,
    confidence: conclusion.confidence,
    attempts: {
      count: attempts.length,
      maxRelevance: attempts.length > 0 ? Math.max(...attempts.map((a) => a.relevance)) : 0,
      targets: [...new Set(attempts.map((a) => a.target))],
    },
    evidencePaths: conclusion.evidencePaths,
    reasoningSteps: reasoningPath.map((step) => ({
      step: step.step,
      type: step.type,
      target: step.target,
      relevance: step.relevance,
      result: step.result,
    })),
  };
}
