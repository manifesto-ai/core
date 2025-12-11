/**
 * Reasoning Loop Implementation
 *
 * 추론 루프 메인 구현
 * - ReasoningLoop 클래스
 * - createReasoningLoop 팩토리 함수
 */

import { ok, err } from '@manifesto-ai/core';
import type { Result } from '@manifesto-ai/core';
import type { CompressionTree } from '../sct/index.js';
import type {
  ReasoningState,
  ParsedQuery,
  Conclusion,
  ReasoningStep,
} from '../reasoning/index.js';
import {
  createReasoningState,
  addReasoningStep,
  setRetrievedContext,
  addRetrievedNodes,
  setQueryStatus,
  setParsedQuery,
  setConclusion,
  buildStructuredExplanation,
  getAvgRelevance,
} from '../reasoning/index.js';
import type { IContextQueryEngine, IAsyncContextQueryEngine } from '../cqe/index.js';
import { projectWithinBudget } from '../cqe/index.js';
import type { ILLMClient } from '../llm/index.js';
import type {
  IReasoningLoop,
  LoopConfig,
  LoopDependencies,
  LoopResult,
  LoopError,
  SelectedAction,
} from './types.js';
import { DEFAULT_LOOP_CONFIG } from './types.js';
import {
  selectNextAction,
  isTerminalState,
  describeAction,
} from './selector.js';
import {
  buildAnalyzePrompt,
  buildAnswerPrompt,
  buildUncertainPrompt,
  getSystemMessage,
  PARSED_QUERY_SCHEMA,
} from './prompts.js';

// ═══════════════════════════════════════════════════════
// ReasoningLoop Implementation
// ═══════════════════════════════════════════════════════

/**
 * 추론 루프 구현
 *
 * 핵심 기능:
 * - run: 질의에 대한 추론 실행
 * - continue: 기존 상태에서 추론 계속
 *
 * 특징:
 * - "Explainable Ignorance": 정보 부재 시 LLM 호출 없이 시스템이 결정
 * - 모든 추론 시도를 reasoningPath에 기록
 */
export class ReasoningLoop implements IReasoningLoop {
  private readonly llm: ILLMClient;
  private readonly cqe: IContextQueryEngine | IAsyncContextQueryEngine;
  private readonly config: LoopConfig;

  constructor(deps: LoopDependencies) {
    this.llm = deps.llmClient;
    this.cqe = deps.cqeEngine;
    this.config = { ...DEFAULT_LOOP_CONFIG, ...deps.config };
  }

  /**
   * 질의에 대한 추론 실행
   */
  async run(
    query: string,
    tree: CompressionTree
  ): Promise<Result<LoopResult, LoopError>> {
    // 1. 초기 상태 생성
    const state = createReasoningState(query);

    // 2. 추론 루프 실행
    return this.continue(state, tree);
  }

  /**
   * 현재 상태에서 추론 계속
   */
  async continue(
    state: ReasoningState,
    tree: CompressionTree
  ): Promise<Result<LoopResult, LoopError>> {
    let currentState = state;
    let iteration = 0;

    while (iteration < this.config.maxIterations) {
      // 종료 상태 확인
      if (isTerminalState(currentState)) {
        break;
      }

      // 다음 액션 선택
      const action = selectNextAction(currentState, this.config);

      // 액션 실행
      const result = await this.executeAction(action, currentState, tree);
      if (!result.ok) {
        return result;
      }
      currentState = result.value;

      iteration++;
    }

    // 최대 반복 초과 시
    if (!isTerminalState(currentState)) {
      return err({
        code: 'MAX_ITERATIONS_EXCEEDED',
        message: `추론 루프가 ${this.config.maxIterations}회 반복 후에도 결론에 도달하지 못했습니다.`,
      });
    }

    // 결론이 없으면 에러
    if (!currentState.conclusion) {
      return err({
        code: 'INVALID_STATE',
        message: '결론 없이 종료 상태에 도달했습니다.',
      });
    }

    // 결과 반환
    const explanation = buildStructuredExplanation(
      currentState.conclusion,
      currentState.reasoningPath
    );

    return ok({
      state: currentState,
      conclusion: currentState.conclusion,
      iterations: iteration,
      explanation: JSON.stringify(explanation, null, 2),
    });
  }

  /**
   * 액션 실행
   */
  private async executeAction(
    action: SelectedAction,
    state: ReasoningState,
    tree: CompressionTree
  ): Promise<Result<ReasoningState, LoopError>> {
    switch (action.type) {
      case 'analyze':
        return this.executeAnalyze(state);
      case 'retrieve':
        return this.executeRetrieve(state, tree);
      case 'expand':
        return this.executeExpand(state, tree, action.nodeId);
      case 'conclude_answer':
        return this.executeConcludeAnswer(state);
      case 'conclude_not_found':
        return this.executeConcludeNotFound(state);
      case 'conclude_uncertain':
        return this.executeConcludeUncertain(state);
      case 'terminal':
        return ok(state);
    }
  }

  // ─────────────────────────────────────────────────────
  // Action Implementations
  // ─────────────────────────────────────────────────────

  /**
   * 질의 분석 액션 실행
   */
  private async executeAnalyze(
    state: ReasoningState
  ): Promise<Result<ReasoningState, LoopError>> {
    // LLM에 질의 분석 요청
    const prompt = buildAnalyzePrompt(state.currentQuery.raw);

    const llmResult = await this.llm.call([
      { role: 'system', content: getSystemMessage() },
      { role: 'user', content: prompt },
    ]);

    if (!llmResult.ok) {
      return err({
        code: 'LLM_ERROR',
        message: 'LLM 호출 실패',
        details: llmResult.error,
      });
    }

    // JSON 파싱
    let parsed: ParsedQuery;
    try {
      parsed = JSON.parse(llmResult.value.content);
    } catch (e) {
      return err({
        code: 'PARSE_ERROR',
        message: 'ParsedQuery JSON 파싱 실패',
        details: { content: llmResult.value.content, error: e },
      });
    }

    // 상태 업데이트
    let newState = setParsedQuery(state, parsed);
    newState = setQueryStatus(newState, 'analyzing');

    // 추론 단계 추가
    const step: ReasoningStep = {
      step: newState.reasoningPath.length + 1,
      type: 'analyze',
      target: state.currentQuery.raw,
      relevance: 1,
      result: `intent: ${parsed.intent}, paths: ${parsed.targetPaths.join(', ')}`,
      evidence: [],
    };
    newState = addReasoningStep(newState, step);

    return ok(newState);
  }

  /**
   * 컨텍스트 검색 액션 실행
   */
  private async executeRetrieve(
    state: ReasoningState,
    tree: CompressionTree
  ): Promise<Result<ReasoningState, LoopError>> {
    const parsed = state.currentQuery.parsed;
    if (!parsed) {
      return err({
        code: 'INVALID_STATE',
        message: 'ParsedQuery가 없습니다.',
      });
    }

    // CQE로 검색
    const retrieveResult = this.cqe.retrieve(parsed, tree, {
      tokenBudget: this.config.tokenBudget,
    });

    if (!retrieveResult.ok) {
      return err({
        code: 'CQE_ERROR',
        message: 'CQE 검색 실패',
        details: retrieveResult.error,
      });
    }

    const nodes = retrieveResult.value;

    // 상태 업데이트
    let newState = setRetrievedContext(state, nodes);
    newState = setQueryStatus(newState, 'reasoning');

    // 추론 단계 추가
    const avgRelevance = nodes.length > 0
      ? nodes.reduce((sum, n) => sum + n.relevance, 0) / nodes.length
      : 0;

    const step: ReasoningStep = {
      step: newState.reasoningPath.length + 1,
      type: 'retrieve',
      target: parsed.targetPaths.join(', ') || 'all',
      relevance: avgRelevance,
      result: `${nodes.length}개 노드 검색됨`,
      evidence: nodes.map((n) => n.semanticPaths[0] ?? n.nodeId),
    };
    newState = addReasoningStep(newState, step);

    return ok(newState);
  }

  /**
   * 노드 확장 액션 실행
   */
  private async executeExpand(
    state: ReasoningState,
    tree: CompressionTree,
    nodeId: string
  ): Promise<Result<ReasoningState, LoopError>> {
    const parsed = state.currentQuery.parsed;
    if (!parsed) {
      return err({
        code: 'INVALID_STATE',
        message: 'ParsedQuery가 없습니다.',
      });
    }

    // CQE로 노드 확장
    const expandResult = this.cqe.expandNode(nodeId, tree, parsed, {
      tokenBudget: this.config.tokenBudget,
    });

    if (!expandResult.ok) {
      return err({
        code: 'CQE_ERROR',
        message: '노드 확장 실패',
        details: expandResult.error,
      });
    }

    const newNodes = expandResult.value;

    // 상태 업데이트 (기존 컨텍스트에 추가)
    let newState = addRetrievedNodes(state, newNodes);

    // 추론 단계 추가
    const avgRelevance = newNodes.length > 0
      ? newNodes.reduce((sum, n) => sum + n.relevance, 0) / newNodes.length
      : 0;

    const step: ReasoningStep = {
      step: newState.reasoningPath.length + 1,
      type: 'expand',
      target: nodeId,
      relevance: avgRelevance,
      result: newNodes.length > 0
        ? `${newNodes.length}개 자식 노드 발견`
        : 'no_children',
      evidence: newNodes.map((n) => n.semanticPaths[0] ?? n.nodeId),
    };
    newState = addReasoningStep(newState, step);

    return ok(newState);
  }

  /**
   * 답변 도출 액션 실행
   */
  private async executeConcludeAnswer(
    state: ReasoningState
  ): Promise<Result<ReasoningState, LoopError>> {
    // 컨텍스트 프로젝션
    const projected = projectWithinBudget(
      state.retrievedContext,
      this.config.tokenBudget
    );

    // LLM에 답변 생성 요청
    const prompt = buildAnswerPrompt(state, projected);

    const llmResult = await this.llm.call([
      { role: 'system', content: getSystemMessage() },
      { role: 'user', content: prompt },
    ]);

    if (!llmResult.ok) {
      return err({
        code: 'LLM_ERROR',
        message: 'LLM 호출 실패',
        details: llmResult.error,
      });
    }

    const answer = llmResult.value.content;

    // 결론 생성
    const conclusion: Conclusion = {
      type: 'answer',
      content: answer,
      confidence: getAvgRelevance(state),
      evidencePaths: state.retrievedContext.map(
        (n) => n.semanticPaths[0] ?? n.nodeId
      ),
    };

    // 상태 업데이트
    let newState = setConclusion(state, conclusion);
    newState = setQueryStatus(newState, 'complete');

    // 추론 단계 추가
    const step: ReasoningStep = {
      step: newState.reasoningPath.length + 1,
      type: 'conclude',
      target: 'answer',
      relevance: conclusion.confidence,
      result: 'answer_generated',
      evidence: conclusion.evidencePaths,
    };
    newState = addReasoningStep(newState, step);

    return ok(newState);
  }

  /**
   * 정보 부재 결론 액션 실행
   *
   * ★ 핵심: LLM 호출 없이 시스템이 결정
   */
  private async executeConcludeNotFound(
    state: ReasoningState
  ): Promise<Result<ReasoningState, LoopError>> {
    // 결론 생성 (LLM 호출 없음!)
    const conclusion: Conclusion = {
      type: 'not_found',
      content: '요청하신 정보를 찾을 수 없습니다.',
      confidence: 0.95, // 구조적 판단이므로 높은 신뢰도
      evidencePaths: state.reasoningPath.map((step) => step.target),
    };

    // 상태 업데이트
    let newState = setConclusion(state, conclusion);
    newState = setQueryStatus(newState, 'not_found');

    // 추론 단계 추가
    const step: ReasoningStep = {
      step: newState.reasoningPath.length + 1,
      type: 'not_found',
      target: 'system.conclusion',
      relevance: 0,
      result: 'information_not_found',
      evidence: state.reasoningPath.map((step) => step.target),
    };
    newState = addReasoningStep(newState, step);

    return ok(newState);
  }

  /**
   * 불확실 결론 액션 실행
   */
  private async executeConcludeUncertain(
    state: ReasoningState
  ): Promise<Result<ReasoningState, LoopError>> {
    // 컨텍스트 프로젝션
    const projected = projectWithinBudget(
      state.retrievedContext,
      this.config.tokenBudget
    );

    // LLM에 불확실성 설명 요청
    const prompt = buildUncertainPrompt(state, projected);

    const llmResult = await this.llm.call([
      { role: 'system', content: getSystemMessage() },
      { role: 'user', content: prompt },
    ]);

    if (!llmResult.ok) {
      return err({
        code: 'LLM_ERROR',
        message: 'LLM 호출 실패',
        details: llmResult.error,
      });
    }

    const explanation = llmResult.value.content;

    // 결론 생성
    const conclusion: Conclusion = {
      type: 'uncertain',
      content: explanation,
      confidence: getAvgRelevance(state),
      evidencePaths: state.retrievedContext.map(
        (n) => n.semanticPaths[0] ?? n.nodeId
      ),
    };

    // 상태 업데이트
    let newState = setConclusion(state, conclusion);
    newState = setQueryStatus(newState, 'complete');

    // 추론 단계 추가
    const step: ReasoningStep = {
      step: newState.reasoningPath.length + 1,
      type: 'conclude',
      target: 'uncertain',
      relevance: conclusion.confidence,
      result: 'uncertain_conclusion',
      evidence: conclusion.evidencePaths,
    };
    newState = addReasoningStep(newState, step);

    return ok(newState);
  }
}

// ═══════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════

/**
 * 추론 루프 인스턴스 생성
 *
 * @param deps - 의존성 (llmClient, cqeEngine, config)
 * @returns IReasoningLoop 인스턴스
 */
export function createReasoningLoop(deps: LoopDependencies): IReasoningLoop {
  return new ReasoningLoop(deps);
}
