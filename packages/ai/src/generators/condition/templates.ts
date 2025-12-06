/**
 * Condition Templates - Template-First Pattern Implementation
 *
 * 자주 사용되는 비즈니스 규칙 패턴을 템플릿으로 정의
 * LLM 호출 없이 빠르게 Expression AST 생성 가능
 */

import type { Expression } from '@manifesto-ai/schema'

// ============================================================================
// Types
// ============================================================================

export interface TemplatePattern {
  readonly name: string
  readonly category: 'permission' | 'status' | 'comparison' | 'presence' | 'composite'
  readonly patterns: readonly RegExp[]
  readonly extract: (match: RegExpMatchArray, availableFields: readonly string[]) => TemplateMatch | null
}

export interface TemplateMatch {
  readonly templateName: string
  readonly expression: Expression
  readonly referencedFields: readonly string[]
  readonly confidence: number
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 필드 이름 추론 (자연어에서 필드 ID 찾기)
 */
const inferFieldId = (text: string, availableFields: readonly string[]): string | null => {
  const normalized = text.toLowerCase().trim()

  // 1. 정확히 일치하는 필드
  const exactMatch = availableFields.find(f => f.toLowerCase() === normalized)
  if (exactMatch) return exactMatch

  // 2. 한글 → camelCase 매핑 (일반적인 패턴)
  const koreanToFieldMap: Record<string, readonly string[]> = {
    '상태': ['status', 'state', 'statusCode'],
    '등급': ['grade', 'tier', 'level', 'rank'],
    '타입': ['type', 'category', 'kind'],
    '유형': ['type', 'category', 'kind'],
    '금액': ['amount', 'price', 'total', 'value'],
    '총액': ['total', 'totalAmount', 'amount', 'sum'],
    '가격': ['price', 'amount', 'cost', 'value'],
    '수량': ['quantity', 'count', 'qty'],
    '이름': ['name', 'title', 'displayName'],
    '제목': ['title', 'name', 'subject', 'heading'],
    '날짜': ['date', 'createdAt', 'updatedAt'],
    '이메일': ['email', 'emailAddress'],
    '전화': ['phone', 'phoneNumber', 'tel'],
    '전화번호': ['phone', 'phoneNumber', 'tel'],
    '주소': ['address', 'addr'],
    '설명': ['description', 'desc', 'note'],
    '비고': ['remark', 'note', 'memo'],
    '고객': ['customer', 'client', 'user'],
    '회원': ['member', 'user'],
    '권한': ['role', 'permission', 'authority'],
    '역할': ['role', 'userRole'],
  }

  for (const [korean, candidates] of Object.entries(koreanToFieldMap)) {
    if (normalized.includes(korean)) {
      const match = candidates.find(c => availableFields.some(f => f.toLowerCase().includes(c)))
      if (match) {
        return availableFields.find(f => f.toLowerCase().includes(match)) ?? null
      }
    }
  }

  // 3. 부분 일치
  const partialMatch = availableFields.find(f =>
    f.toLowerCase().includes(normalized) || normalized.includes(f.toLowerCase())
  )
  if (partialMatch) return partialMatch

  return null
}

/**
 * 값 추론 (자연어에서 값 추출)
 */
const inferValue = (text: string): string | number | boolean => {
  const normalized = text.toLowerCase().trim()

  // Boolean
  if (['true', '예', '네', '참', 'yes'].includes(normalized)) return true
  if (['false', '아니오', '아니', '거짓', 'no'].includes(normalized)) return false

  // Number
  const numMatch = text.match(/[\d,]+(?:\.\d+)?/)
  if (numMatch) {
    const num = parseFloat(numMatch[0].replace(/,/g, ''))
    if (!isNaN(num)) return num
  }

  // String (기본)
  return text.trim()
}

// ============================================================================
// Template Patterns
// ============================================================================

/**
 * 권한/역할 패턴
 * "VIP 고객만", "관리자만", "프리미엄 회원만"
 */
const permissionPatterns: TemplatePattern = {
  name: 'permission',
  category: 'permission',
  patterns: [
    /^(VIP|vip|프리미엄|골드|실버|브론즈|관리자|매니저|일반)?\s*(고객|회원|사용자|유저)만$/,
    /^(관리자|매니저|어드민|admin)\s*만$/i,
    /^역할이?\s*(.+)(?:일|인)\s*(?:경우|때)(?:만)?$/,
    /^권한이?\s*(.+)(?:일|인)\s*(?:경우|때)(?:만)?$/,
  ],
  extract: (match, availableFields) => {
    const roleOrGrade = match[1] || match[2] || 'VIP'

    // status, grade, role, tier 중 하나 찾기
    const roleField = inferFieldId('등급', availableFields)
      ?? inferFieldId('역할', availableFields)
      ?? inferFieldId('상태', availableFields)

    if (!roleField) return null

    const value = roleOrGrade.toUpperCase()

    return {
      templateName: 'permission.roleEquals',
      expression: ['==', `$state.${roleField}`, value] as Expression,
      referencedFields: [roleField],
      confidence: 0.9,
    }
  },
}

/**
 * 상태 패턴
 * "상태가 X일 때", "상태가 X가 아니면"
 */
const statusPatterns: TemplatePattern = {
  name: 'status',
  category: 'status',
  patterns: [
    /^상태가?\s*['"]?(.+?)['"]?\s*(?:일|인)\s*(?:경우|때)$/,
    /^상태가?\s*['"]?(.+?)['"]?\s*(?:가|이)\s*아닌?\s*(?:경우|때)$/,
    /^(.+)\s*상태(?:일|인)\s*(?:경우|때)$/,
  ],
  extract: (match, availableFields) => {
    const statusValue = match[1]?.trim()
    if (!statusValue) return null

    const statusField = inferFieldId('상태', availableFields)
    if (!statusField) return null

    const isNegative = match[0].includes('아닌') || match[0].includes('아니')
    const operator = isNegative ? '!=' : '=='
    const value = inferValue(statusValue)

    return {
      templateName: isNegative ? 'status.notEquals' : 'status.equals',
      expression: [operator, `$state.${statusField}`, value] as Expression,
      referencedFields: [statusField],
      confidence: 0.85,
    }
  },
}

/**
 * 비교 패턴
 * "금액이 100만원 이상", "수량이 0보다 큼"
 */
const comparisonPatterns: TemplatePattern = {
  name: 'comparison',
  category: 'comparison',
  patterns: [
    /^(.+?)(?:이|가)?\s*([\d,]+(?:\.\d+)?)\s*(?:만?원|개|명)?\s*(이상|이하|초과|미만)$/,
    /^(.+?)(?:이|가)?\s*([\d,]+(?:\.\d+)?)\s*(?:만?원|개|명)?\s*보다\s*(크|작|큼|작음)$/,
    /^(.+?)(?:이|가)?\s*([\d,]+(?:\.\d+)?)\s*(?:만?원|개|명)?\s*(?:와|과)?\s*(같|동일)(?:으면|하면)?$/,
  ],
  extract: (match, availableFields) => {
    const fieldHint = match[1]?.trim()
    const numStr = match[2]
    const comparison = match[3]?.trim()

    if (!fieldHint || !numStr || !comparison) return null

    const field = inferFieldId(fieldHint, availableFields)
    if (!field) return null

    let value = parseFloat(numStr.replace(/,/g, ''))
    // "만원" 처리
    if (match[0].includes('만원')) {
      value *= 10000
    }

    let operator: '==' | '!=' | '>' | '>=' | '<' | '<='
    if (comparison.includes('이상') || comparison.includes('크거나')) {
      operator = '>='
    } else if (comparison.includes('이하') || comparison.includes('작거나')) {
      operator = '<='
    } else if (comparison.includes('초과') || comparison.includes('크')) {
      operator = '>'
    } else if (comparison.includes('미만') || comparison.includes('작')) {
      operator = '<'
    } else if (comparison.includes('같') || comparison.includes('동일')) {
      operator = '=='
    } else {
      return null
    }

    return {
      templateName: `comparison.${operator}`,
      expression: [operator, `$state.${field}`, value] as Expression,
      referencedFields: [field],
      confidence: 0.9,
    }
  },
}

/**
 * 존재/빈값 패턴
 * "이름이 비어있으면", "값이 있으면", "입력되었으면"
 */
const presencePatterns: TemplatePattern = {
  name: 'presence',
  category: 'presence',
  patterns: [
    /^(.+?)(?:이|가)?\s*비어\s*있(?:으면|는\s*경우)$/,
    /^(.+?)(?:이|가)?\s*없(?:으면|는\s*경우)$/,
    /^(.+?)(?:이|가)?\s*있(?:으면|는\s*경우)$/,
    /^(.+?)(?:이|가)?\s*입력(?:되었으면|된\s*경우)$/,
    /^(.+?)(?:이|가)?\s*(?:선택|설정)(?:되었으면|된\s*경우)$/,
  ],
  extract: (match, availableFields) => {
    const fieldHint = match[1]?.trim()
    if (!fieldHint) return null

    const field = inferFieldId(fieldHint, availableFields)
    if (!field) return null

    const isEmpty = match[0].includes('비어') || match[0].includes('없')
    const operator = isEmpty ? 'IS_EMPTY' : 'IS_NOT_NULL'

    return {
      templateName: isEmpty ? 'presence.isEmpty' : 'presence.hasValue',
      expression: [operator, `$state.${field}`] as Expression,
      referencedFields: [field],
      confidence: 0.85,
    }
  },
}

/**
 * 복합 조건 패턴 (AND/OR)
 * "A이고 B일 때", "A이거나 B일 때"
 */
const compositePatterns: TemplatePattern = {
  name: 'composite',
  category: 'composite',
  patterns: [
    /^(.+?)(?:이고|이면서|그리고)\s*(.+)$/,
    /^(.+?)(?:이거나|또는)\s*(.+)$/,
  ],
  extract: (_match, _availableFields) => {
    // 복합 조건은 LLM fallback으로 처리
    // 여기서는 null 반환하여 LLM에게 위임
    return null
  },
}

// ============================================================================
// Template Registry
// ============================================================================

export const TEMPLATE_REGISTRY: readonly TemplatePattern[] = [
  permissionPatterns,
  statusPatterns,
  comparisonPatterns,
  presencePatterns,
  compositePatterns,
]

// ============================================================================
// Template Matching
// ============================================================================

/**
 * 자연어 규칙에서 템플릿 매칭 시도
 */
export const matchTemplate = (
  naturalLanguageRule: string,
  availableFields: readonly string[]
): TemplateMatch | null => {
  const normalized = naturalLanguageRule.trim()

  for (const template of TEMPLATE_REGISTRY) {
    for (const pattern of template.patterns) {
      const match = normalized.match(pattern)
      if (match) {
        const result = template.extract(match, availableFields)
        if (result && result.confidence >= 0.6) {
          return result
        }
      }
    }
  }

  return null
}

/**
 * 템플릿 매칭 가능 여부 확인 (dry run)
 */
export const canMatchTemplate = (naturalLanguageRule: string): boolean => {
  const normalized = naturalLanguageRule.trim()

  for (const template of TEMPLATE_REGISTRY) {
    for (const pattern of template.patterns) {
      if (pattern.test(normalized)) {
        return true
      }
    }
  }

  return false
}

/**
 * 사용 가능한 템플릿 카테고리 목록
 */
export const getTemplateCategories = (): readonly string[] => {
  return [...new Set(TEMPLATE_REGISTRY.map(t => t.category))]
}
