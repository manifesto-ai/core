/**
 * LoggerMiddleware
 *
 * Intent 실행 전후로 로깅을 수행하는 미들웨어
 * - 실행 시작/완료 로깅
 * - 실행 시간 측정
 * - 에러 로깅
 */

import type { IntentMiddleware } from '../../types/dispatcher'
import type { ViewIntent, IntentResult } from '../../types/intents'

// ============================================================================
// Types
// ============================================================================

export interface LoggerOptions {
  /** 로거 함수 (기본: console.log) */
  logger?: (...args: unknown[]) => void
  /** 에러 로거 함수 (기본: console.error) */
  errorLogger?: (...args: unknown[]) => void
  /** 로그 접두사 */
  prefix?: string
  /** 실행 시간 측정 여부 */
  measureTime?: boolean
}

// ============================================================================
// LoggerMiddleware
// ============================================================================

/**
 * 로깅 미들웨어 생성
 *
 * @param options 로거 옵션
 * @returns IntentMiddleware
 */
export const createLoggerMiddleware = (options: LoggerOptions = {}): IntentMiddleware => {
  const {
    logger = console.log,
    errorLogger = console.error,
    prefix = '[Intent]',
    measureTime = true,
  } = options

  return async (intent: ViewIntent, _context, next) => {
    const startTime = measureTime ? performance.now() : 0

    logger(`${prefix} Dispatching: ${intent.type}`, {
      nodeId: 'nodeId' in intent ? intent.nodeId : undefined,
    })

    let result: IntentResult

    try {
      result = await next()
    } catch (error) {
      errorLogger(`${prefix} Error in ${intent.type}:`, error)
      throw error
    }

    if (measureTime) {
      const duration = performance.now() - startTime
      logger(`${prefix} Completed: ${intent.type} (${duration.toFixed(2)}ms)`, {
        success: result.success,
      })
    } else {
      logger(`${prefix} Completed: ${intent.type}`, {
        success: result.success,
      })
    }

    if (!result.success) {
      errorLogger(`${prefix} Failed: ${intent.type}`, {
        errorType: result.errorType,
        message: result.message,
      })
    }

    return result
  }
}
