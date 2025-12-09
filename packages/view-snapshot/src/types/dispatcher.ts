/**
 * Intent Dispatcher Types
 *
 * Strategy Pattern + Chain of Responsibility Pattern을 위한 타입 정의
 * - IntentHandler: 특정 Intent를 처리하는 전략 (Strategy)
 * - IntentMiddleware: 실행 전후를 가로채는 파이프라인 (Middleware)
 */

import type { ViewIntent, IntentResult } from './intents'
import type { INodeRegistry } from '../engine/NodeRegistry'
import type { IOverlayManager } from '../engine/OverlayManager'

// ============================================================================
// Handler Context
// ============================================================================

/**
 * 핸들러와 미들웨어가 공유하는 실행 컨텍스트
 */
export interface HandlerContext {
  /** Node Registry (Form/List Runtime 관리) */
  readonly nodeRegistry: INodeRegistry
  /** Overlay Manager (Modal/Dialog/Toast 관리) */
  readonly overlayManager: IOverlayManager
  /** 탭 변경 콜백 */
  readonly onTabChange?: (nodeId: string, tabId: string) => void
  /** 액션 트리거 콜백 */
  readonly onActionTrigger?: (nodeId: string, actionType: string) => Promise<void>
  /** 디버그 모드 */
  readonly debug?: boolean
}

// ============================================================================
// Intent Handler (Strategy Pattern)
// ============================================================================

/**
 * Intent 핸들러 인터페이스
 *
 * 특정 Intent 타입들을 처리하는 전략(Strategy)
 * 각 도메인(Form, Table, Overlay 등)별로 구현
 */
export interface IntentHandler<T extends ViewIntent = ViewIntent> {
  /** 이 핸들러가 처리하는 Intent 타입 목록 */
  readonly targets: readonly T['type'][]

  /**
   * Intent 실행
   * @param intent 실행할 Intent
   * @param context 실행 컨텍스트
   * @returns 실행 결과
   */
  execute(intent: T, context: HandlerContext): Promise<IntentResult>
}

// ============================================================================
// Middleware (Chain of Responsibility Pattern)
// ============================================================================

/**
 * 다음 미들웨어/핸들러를 호출하는 함수
 */
export type NextFunction = () => Promise<IntentResult>

/**
 * Intent 미들웨어
 *
 * 실행 전후를 가로채는 파이프라인 층
 * - 로깅, 가드레일, Undo, 메트릭스 등 횡단 관심사 처리
 *
 * @param intent 현재 Intent
 * @param context 실행 컨텍스트
 * @param next 다음 미들웨어/핸들러 호출 함수
 * @returns 실행 결과
 */
export type IntentMiddleware = (
  intent: ViewIntent,
  context: HandlerContext,
  next: NextFunction
) => Promise<IntentResult>

/**
 * 미들웨어 등록 옵션
 */
export interface MiddlewareOptions {
  /** 우선순위 (높을수록 먼저 실행, 기본값: 0) */
  priority?: number
  /** 미들웨어 이름 (디버깅용) */
  name?: string
}

/**
 * 등록된 미들웨어 정보
 */
export interface RegisteredMiddleware {
  middleware: IntentMiddleware
  priority: number
  name?: string
}

// ============================================================================
// Dispatcher Interface
// ============================================================================

/**
 * Intent Dispatcher 인터페이스
 */
export interface IIntentDispatcher {
  /**
   * 핸들러 등록
   * @param handler Intent 핸들러
   */
  register(handler: IntentHandler): void

  /**
   * 미들웨어 등록
   * @param middleware 미들웨어 함수
   * @param options 등록 옵션
   */
  use(middleware: IntentMiddleware, options?: MiddlewareOptions): void

  /**
   * Intent 디스패치
   * @param intent 실행할 Intent
   * @returns 실행 결과
   */
  dispatch(intent: ViewIntent): Promise<IntentResult>
}

// ============================================================================
// Undo Support Types
// ============================================================================

/**
 * Undo 히스토리 항목
 */
export interface UndoHistoryEntry {
  /** 원본 Intent */
  readonly original: ViewIntent
  /** 역방향 Intent (Undo용) */
  readonly inverse: ViewIntent
  /** 실행 시각 */
  readonly timestamp: number
}

/**
 * 역방향 Intent 생성 함수
 */
export type InverseIntentCreator = (
  intent: ViewIntent,
  context: HandlerContext
) => Promise<ViewIntent | null>
