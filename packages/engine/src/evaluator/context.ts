/**
 * Evaluation Context
 *
 * 표현식 평가에 필요한 컨텍스트 데이터 관리
 */

export interface EvaluationContext {
  /** 현재 폼 상태 */
  readonly state: Record<string, unknown>
  /** 앱 컨텍스트 (브랜드/환경 설정 등) */
  readonly context: Record<string, unknown>
  /** 유저 정보 */
  readonly user: Record<string, unknown>
  /** URL/라우트 파라미터 */
  readonly params: Record<string, unknown>
  /** 이전 액션 결과 */
  readonly result: Record<string, unknown>
  /** 환경 변수 (화이트리스트) */
  readonly env: Record<string, unknown>
}

export const createEmptyContext = (): EvaluationContext => ({
  state: {},
  context: {},
  user: {},
  params: {},
  result: {},
  env: {},
})

export const createContext = (
  partial: Partial<EvaluationContext>
): EvaluationContext => ({
  ...createEmptyContext(),
  ...partial,
})

/**
 * 점 표기법으로 객체에서 값을 가져옴
 *
 * @example
 * getByPath({ a: { b: 1 } }, 'a.b') // 1
 */
export const getByPath = (obj: Record<string, unknown>, path: string): unknown => {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * 컨텍스트 참조 문자열을 파싱하여 값을 가져옴
 *
 * @example
 * resolveContextReference(ctx, '$state.name') // ctx.state.name
 */
export const resolveContextReference = (
  ctx: EvaluationContext,
  ref: string
): unknown => {
  if (!ref.startsWith('$')) {
    return undefined
  }

  const [namespace, ...rest] = ref.slice(1).split('.')
  const path = rest.join('.')

  switch (namespace) {
    case 'state':
      return getByPath(ctx.state, path)
    case 'context':
      return getByPath(ctx.context, path)
    case 'user':
      return getByPath(ctx.user, path)
    case 'params':
      return getByPath(ctx.params, path)
    case 'result':
      return getByPath(ctx.result, path)
    case 'env':
      return getByPath(ctx.env, path)
    default:
      return undefined
  }
}
