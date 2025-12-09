/**
 * IntentDispatcher
 *
 * Strategy Pattern + Chain of Responsibility Pattern을 결합한 Intent 디스패처
 *
 * - Strategy Pattern: 각 도메인(Form, Table, Overlay 등)별 핸들러로 비즈니스 로직 분리
 * - Middleware Pipeline: 로깅, 가드레일, Undo 등 횡단 관심사 처리
 */

import type { ViewIntent, IntentResult } from '../types/intents'
import type {
  IntentHandler,
  IntentMiddleware,
  MiddlewareOptions,
  RegisteredMiddleware,
  HandlerContext,
  IIntentDispatcher,
} from '../types/dispatcher'
import type { INodeRegistry } from './NodeRegistry'
import type { IOverlayManager } from './OverlayManager'

// ============================================================================
// Types
// ============================================================================

/**
 * Intent 디스패처 옵션
 */
export interface IntentDispatcherOptions {
  /** 디버그 모드 */
  debug?: boolean
  /** 탭 상태 변경 핸들러 */
  onTabChange?: (nodeId: string, tabId: string) => void
  /** 액션 트리거 핸들러 */
  onActionTrigger?: (nodeId: string, actionType: string) => Promise<void>
}

// ============================================================================
// IntentDispatcher
// ============================================================================

/**
 * Intent 디스패처 구현
 *
 * Onion Architecture:
 * 요청(Intent)은 여러 겹의 미들웨어 층을 통과해야만 핵심 로직(Handler)에 도달
 *
 * ```
 * [Middleware 1] → [Middleware 2] → [Middleware N] → [Handler]
 *                                                        ↓
 * [Middleware 1] ← [Middleware 2] ← [Middleware N] ← [Result]
 * ```
 */
export class IntentDispatcher implements IIntentDispatcher {
  // 전략 저장소 (Strategy Pattern)
  private handlers = new Map<string, IntentHandler>()

  // 파이프라인 (Chain of Responsibility)
  private middlewares: RegisteredMiddleware[] = []

  // 실행 컨텍스트
  private context: HandlerContext

  constructor(
    nodeRegistry: INodeRegistry,
    overlayManager: IOverlayManager,
    options: IntentDispatcherOptions = {}
  ) {
    this.context = {
      nodeRegistry,
      overlayManager,
      onTabChange: options.onTabChange,
      onActionTrigger: options.onActionTrigger,
      debug: options.debug,
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * 핸들러 등록 (OCP: 확장에 열려있고 수정에 닫혀있음)
   *
   * @param handler Intent 핸들러
   */
  register(handler: IntentHandler): void {
    for (const type of handler.targets) {
      if (this.handlers.has(type)) {
        this.log(`Warning: Handler for "${type}" is being overwritten`)
      }
      this.handlers.set(type, handler)
    }
    this.log(`Registered handler for: ${handler.targets.join(', ')}`)
  }

  /**
   * 미들웨어 등록 (AOP: 횡단 관심사 분리)
   *
   * @param middleware 미들웨어 함수
   * @param options 등록 옵션
   */
  use(middleware: IntentMiddleware, options: MiddlewareOptions = {}): void {
    const { priority = 0, name } = options

    this.middlewares.push({ middleware, priority, name })

    // 우선순위로 정렬 (높을수록 먼저 실행)
    this.middlewares.sort((a, b) => b.priority - a.priority)

    this.log(`Registered middleware: ${name ?? 'anonymous'} (priority: ${priority})`)
  }

  /**
   * Intent 디스패치 (The Execution Loop)
   *
   * @param intent 실행할 Intent
   * @returns 실행 결과
   */
  async dispatch(intent: ViewIntent): Promise<IntentResult> {
    this.log(`Dispatching: ${intent.type}`)

    // 미들웨어 체인 실행기
    const runner = async (index: number): Promise<IntentResult> => {
      // 1. 모든 미들웨어를 통과했으면 → 실제 핸들러 실행
      if (index >= this.middlewares.length) {
        return this.executeHandler(intent)
      }

      // 2. 현재 미들웨어 실행
      const current = this.middlewares[index]!
      const { middleware, name } = current

      this.log(`Running middleware: ${name ?? `[${index}]`}`)

      // 3. next() 호출 시 다음 미들웨어로 진행
      return middleware(intent, this.context, () => runner(index + 1))
    }

    return runner(0)
  }

  // ============================================================================
  // Private
  // ============================================================================

  /**
   * 핸들러 실행
   */
  private async executeHandler(intent: ViewIntent): Promise<IntentResult> {
    const handler = this.handlers.get(intent.type)

    if (!handler) {
      return {
        success: false,
        errorType: 'INVALID_OPERATION',
        message: `No handler registered for intent: ${intent.type}`,
      }
    }

    try {
      return await handler.execute(intent, this.context)
    } catch (error) {
      return {
        success: false,
        errorType: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 디버그 로그
   */
  private log(...args: unknown[]): void {
    if (this.context.debug) {
      console.log('[IntentDispatcher]', ...args)
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * IntentDispatcher 팩토리 함수
 */
export const createIntentDispatcher = (
  nodeRegistry: INodeRegistry,
  overlayManager: IOverlayManager,
  options?: IntentDispatcherOptions
): IntentDispatcher => {
  return new IntentDispatcher(nodeRegistry, overlayManager, options)
}
