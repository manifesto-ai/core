/**
 * Prompt Templates
 *
 * LLM 프롬프트 템플릿
 * - buildAnalyzePrompt: 질의 분석 프롬프트
 * - buildExpandDecisionPrompt: 노드 확장 결정 프롬프트
 * - buildAnswerPrompt: 답변 생성 프롬프트
 * - buildUncertainPrompt: 불확실 결론 프롬프트
 */

import type { ReasoningState, ReasoningStep } from '../reasoning/index.js';
import type { ProjectedContext } from '../cqe/index.js';

// ═══════════════════════════════════════════════════════
// Schema Definitions
// ═══════════════════════════════════════════════════════

/**
 * ParsedQuery JSON 스키마 (for LLM output)
 */
export const PARSED_QUERY_SCHEMA = `{
  "intent": "lookup" | "compare" | "summarize" | "analyze" | "list",
  "targetPaths": string[],    // 예: ["finance.revenue.q3", "marketing.budget"]
  "constraints": [{
    "field": string,
    "operator": "eq" | "gt" | "lt" | "gte" | "lte" | "contains" | "in",
    "value": string | number | boolean | array
  }],
  "expectedDepth": number     // 1-5
}`;

/**
 * Expand Decision JSON 스키마 (for LLM output)
 */
export const EXPAND_DECISION_SCHEMA = `{
  "decision": "expand" | "none",
  "nodeId": string | null,
  "reason": string
}`;

// ═══════════════════════════════════════════════════════
// Analyze Prompt
// ═══════════════════════════════════════════════════════

/**
 * 질의 분석 프롬프트 생성
 *
 * LLM에게 사용자 질의를 분석하여 ParsedQuery JSON을 생성하도록 요청
 *
 * @param rawQuery - 원본 질의
 * @returns 프롬프트 문자열
 */
export function buildAnalyzePrompt(rawQuery: string): string {
  return `You are a query analyzer. Analyze the user's question and extract structured information.

## User Question
"${rawQuery}"

## Task
Convert the question into a structured query object.

## Output Schema
${PARSED_QUERY_SCHEMA}

## Intent Definitions
- lookup: 특정 정보 조회 (예: "2024년 3분기 매출은?")
- compare: 두 개 이상 항목 비교 (예: "A팀과 B팀 실적 비교")
- summarize: 요약 요청 (예: "전체 현황 요약해줘")
- analyze: 분석 요청 (예: "매출 감소 원인 분석")
- list: 목록 요청 (예: "모든 프로젝트 목록")

## Guidelines
1. targetPaths는 정보가 있을 것으로 예상되는 경로들
2. constraints는 필터링 조건 (날짜, 수치 등)
3. expectedDepth는 탐색 깊이 (1: 얕은, 5: 깊은)

## Response
JSON only, no explanation:`;
}

// ═══════════════════════════════════════════════════════
// Expand Decision Prompt
// ═══════════════════════════════════════════════════════

/**
 * 노드 확장 결정 프롬프트 생성
 *
 * 현재 컨텍스트를 보고 어떤 노드를 확장할지 결정
 *
 * @param state - 추론 상태
 * @param context - 프로젝션된 컨텍스트
 * @returns 프롬프트 문자열
 */
export function buildExpandDecisionPrompt(
  state: ReasoningState,
  context: ProjectedContext
): string {
  const query = state.currentQuery.raw;
  const parsed = state.currentQuery.parsed;

  const nodesInfo = context.nodes
    .map(
      (n) =>
        `- [${n.nodeId}] ${n.semanticPaths.join(', ')} (관련성: ${(n.relevance * 100).toFixed(1)}%)`
    )
    .join('\n');

  const reasoningInfo = formatReasoningPath(state.reasoningPath);

  return `You are deciding whether to expand a node for more detailed information.

## User Question
"${query}"

## Parsed Query
Intent: ${parsed?.intent ?? 'unknown'}
Target Paths: ${parsed?.targetPaths?.join(', ') ?? 'none'}

## Current Context Nodes
${nodesInfo || '(없음)'}

## Previous Reasoning Steps
${reasoningInfo || '(없음)'}

## Task
Decide if any node should be expanded to find more relevant information.

## Output Schema
${EXPAND_DECISION_SCHEMA}

## Guidelines
1. 관련성이 낮은 노드들만 있다면 확장 고려
2. 이미 확장한 노드는 다시 확장하지 않음
3. 확장해도 관련 정보를 찾을 가능성이 낮다면 "none" 반환

## Response
JSON only, no explanation:`;
}

// ═══════════════════════════════════════════════════════
// Answer Prompt
// ═══════════════════════════════════════════════════════

/**
 * 답변 생성 프롬프트
 *
 * 컨텍스트를 기반으로 질문에 대한 답변 생성
 *
 * @param state - 추론 상태
 * @param context - 프로젝션된 컨텍스트
 * @returns 프롬프트 문자열
 */
export function buildAnswerPrompt(
  state: ReasoningState,
  context: ProjectedContext
): string {
  const query = state.currentQuery.raw;

  const contextText = context.nodes
    .map(
      (n) =>
        `### [${n.semanticPaths.join(', ')}] (관련성: ${(n.relevance * 100).toFixed(1)}%)\n${n.summary}`
    )
    .join('\n\n');

  const reasoningInfo = formatReasoningPath(state.reasoningPath);

  return `You are answering a question based on the provided context.

## User Question
"${query}"

## Context
${contextText || '*컨텍스트 없음*'}

## Reasoning Path
${reasoningInfo || '(없음)'}

## Guidelines
1. 컨텍스트에 있는 정보만 사용하여 답변
2. 추측하지 말고 사실에 기반하여 답변
3. 관련성이 높은 정보를 우선 활용
4. 간결하고 명확하게 답변

## Response
한국어로 답변하세요:`;
}

// ═══════════════════════════════════════════════════════
// Uncertain Prompt
// ═══════════════════════════════════════════════════════

/**
 * 불확실 결론 프롬프트
 *
 * 불확실한 상황에서 설명 생성
 *
 * @param state - 추론 상태
 * @param context - 프로젝션된 컨텍스트
 * @returns 프롬프트 문자열
 */
export function buildUncertainPrompt(
  state: ReasoningState,
  context: ProjectedContext
): string {
  const query = state.currentQuery.raw;

  const contextText = context.nodes
    .map(
      (n) =>
        `- [${n.semanticPaths.join(', ')}]: ${n.summary.slice(0, 100)}... (관련성: ${(n.relevance * 100).toFixed(1)}%)`
    )
    .join('\n');

  const reasoningInfo = formatReasoningPath(state.reasoningPath);

  return `The system found some potentially relevant information but cannot provide a definitive answer.

## User Question
"${query}"

## Found Context (potentially relevant)
${contextText || '*컨텍스트 없음*'}

## Reasoning Path
${reasoningInfo || '(없음)'}

## Task
Explain why the answer is uncertain and what additional information might help.

## Guidelines
1. 어떤 정보를 찾았는지 설명
2. 왜 확신할 수 없는지 설명
3. 어떤 추가 정보가 있으면 답변 가능한지 제안

## Response
한국어로 설명하세요:`;
}

// ═══════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════

/**
 * 추론 경로를 텍스트로 포맷
 *
 * @param reasoningPath - 추론 단계 배열
 * @returns 포맷된 문자열
 */
export function formatReasoningPath(reasoningPath: ReasoningStep[]): string {
  if (reasoningPath.length === 0) {
    return '';
  }

  return reasoningPath
    .map(
      (step) =>
        `${step.step}. [${step.type}] ${step.target} → ${step.result} (관련성: ${(step.relevance * 100).toFixed(1)}%)`
    )
    .join('\n');
}

/**
 * 컨텍스트 노드를 마크다운으로 포맷
 *
 * @param context - 프로젝션된 컨텍스트
 * @returns 마크다운 문자열
 */
export function formatContextAsMarkdown(context: ProjectedContext): string {
  if (context.nodes.length === 0) {
    return '*관련 컨텍스트 없음*';
  }

  const lines: string[] = [];

  for (const node of context.nodes) {
    lines.push(
      `### [${node.semanticPaths.join(', ')}] (관련성: ${(node.relevance * 100).toFixed(1)}%)`
    );
    lines.push('');
    lines.push(node.summary);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 시스템 메시지 생성 (LLM 호출용)
 *
 * @returns 시스템 메시지
 */
export function getSystemMessage(): string {
  return `You are an AI assistant specialized in information retrieval and reasoning.
Your responses should be:
- Accurate and based only on provided context
- Concise and clear
- In JSON format when specified
- In Korean when responding to users`;
}
