/**
 * AsyncState Types
 *
 * 비동기 상태를 표현하는 타입 정의
 * Agent-Human Isomorphism을 위해 모든 비동기 작업의 상태를 일관되게 표현합니다.
 *
 * ## 사용 예시
 *
 * ```typescript
 * // 테이블 데이터 로딩
 * interface TableSnapshot {
 *   data: AsyncState<TableRow[]>
 * }
 *
 * // 폼 제출
 * interface FormSnapshot {
 *   submitState: AsyncState<void>
 * }
 * ```
 */

// ============================================================================
// Error Types
// ============================================================================

/**
 * 비동기 에러 타입
 *
 * - network: 네트워크 오류 (재시도 가능)
 * - business: 비즈니스 로직 오류 (사용자 액션 필요)
 * - validation: 유효성 검사 오류
 * - auth: 인증/권한 오류
 * - unknown: 알 수 없는 오류
 */
export type AsyncErrorType = 'network' | 'business' | 'validation' | 'auth' | 'unknown'

/**
 * 비동기 에러 정보
 */
export interface AsyncError {
  /** 에러 타입 */
  readonly type: AsyncErrorType
  /** 사용자에게 표시할 메시지 */
  readonly message: string
  /** 에러 코드 (선택적) */
  readonly code?: string
  /** 필드별 에러 (validation 타입일 때) */
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>
  /** 재시도 가능 여부 */
  readonly retryable?: boolean
  /** 원본 에러 (디버깅용) */
  readonly cause?: unknown
}

// ============================================================================
// AsyncState Types
// ============================================================================

/**
 * 유휴 상태 - 아직 시작되지 않음
 */
export interface IdleState {
  readonly status: 'idle'
}

/**
 * 로딩 상태 - 진행 중
 */
export interface LoadingState {
  readonly status: 'loading'
  /** 진행률 (0-100, 선택적) */
  readonly progress?: number
  /** 로딩 메시지 (선택적) */
  readonly message?: string
}

/**
 * 성공 상태 - 완료됨
 */
export interface SuccessState<T> {
  readonly status: 'success'
  /** 결과 데이터 */
  readonly data: T
  /** 성공 시각 */
  readonly timestamp?: number
}

/**
 * 에러 상태 - 실패함
 */
export interface ErrorState {
  readonly status: 'error'
  /** 에러 정보 */
  readonly error: AsyncError
  /** 마지막 시도 시각 */
  readonly timestamp?: number
}

/**
 * 비동기 상태 유니온 타입
 *
 * 모든 비동기 작업의 상태를 표현합니다.
 *
 * @example
 * ```typescript
 * const dataState: AsyncState<User[]> = { status: 'idle' }
 *
 * // 로딩 시작
 * dataState = { status: 'loading' }
 *
 * // 성공
 * dataState = { status: 'success', data: users }
 *
 * // 실패
 * dataState = {
 *   status: 'error',
 *   error: { type: 'network', message: '서버에 연결할 수 없습니다.' }
 * }
 * ```
 */
export type AsyncState<T> = IdleState | LoadingState | SuccessState<T> | ErrorState

// ============================================================================
// Type Guards
// ============================================================================

/**
 * idle 상태인지 확인
 */
export const isIdle = <T>(state: AsyncState<T>): state is IdleState => {
  return state.status === 'idle'
}

/**
 * loading 상태인지 확인
 */
export const isLoading = <T>(state: AsyncState<T>): state is LoadingState => {
  return state.status === 'loading'
}

/**
 * success 상태인지 확인
 */
export const isSuccess = <T>(state: AsyncState<T>): state is SuccessState<T> => {
  return state.status === 'success'
}

/**
 * error 상태인지 확인
 */
export const isError = <T>(state: AsyncState<T>): state is ErrorState => {
  return state.status === 'error'
}

/**
 * 완료 상태인지 확인 (success 또는 error)
 */
export const isSettled = <T>(state: AsyncState<T>): state is SuccessState<T> | ErrorState => {
  return state.status === 'success' || state.status === 'error'
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * idle 상태 생성
 */
export const idle = (): IdleState => ({ status: 'idle' })

/**
 * loading 상태 생성
 */
export const loading = (options?: { progress?: number; message?: string }): LoadingState => ({
  status: 'loading',
  ...options,
})

/**
 * success 상태 생성
 */
export const success = <T>(data: T): SuccessState<T> => ({
  status: 'success',
  data,
  timestamp: Date.now(),
})

/**
 * error 상태 생성
 */
export const error = (err: AsyncError): ErrorState => ({
  status: 'error',
  error: err,
  timestamp: Date.now(),
})

/**
 * 네트워크 에러 생성 헬퍼
 */
export const networkError = (message: string, cause?: unknown): AsyncError => ({
  type: 'network',
  message,
  retryable: true,
  cause,
})

/**
 * 비즈니스 에러 생성 헬퍼
 */
export const businessError = (message: string, code?: string): AsyncError => ({
  type: 'business',
  message,
  code,
  retryable: false,
})

/**
 * 유효성 검사 에러 생성 헬퍼
 */
export const validationError = (
  message: string,
  fieldErrors?: Record<string, readonly string[]>
): AsyncError => ({
  type: 'validation',
  message,
  fieldErrors,
  retryable: false,
})

// ============================================================================
// Utility Types
// ============================================================================

/**
 * AsyncState에서 데이터 타입 추출
 */
export type AsyncData<S> = S extends AsyncState<infer T> ? T : never

/**
 * 데이터가 있는 상태 (success)
 */
export type AsyncWithData<T> = SuccessState<T>

/**
 * 대기 중인 상태 (idle 또는 loading)
 */
export type AsyncPending = IdleState | LoadingState
