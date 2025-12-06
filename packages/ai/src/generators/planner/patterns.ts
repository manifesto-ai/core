/**
 * Planner Patterns - CRUD 패턴 및 산업별 뷰 패턴
 *
 * Entity 역할과 산업에 따른 기본 View 조합 추론
 */

import type { ViewType, ViewPurpose, EntityRole, EntityInfo, ViewPlan } from '../../core/schemas/view-plan.schema'
import { CRUD_PATTERNS } from '../../core/schemas/view-plan.schema'

// ============================================================================
// Types
// ============================================================================

export interface IndustryViewPattern {
  readonly industry: string
  readonly entityPatterns: readonly EntityPattern[]
}

export interface EntityPattern {
  readonly namePattern: RegExp
  readonly suggestedRole: EntityRole
  readonly additionalViews?: readonly { viewType: ViewType; purpose: ViewPurpose }[]
}

// ============================================================================
// Industry-specific Patterns
// ============================================================================

const financePatterns: EntityPattern[] = [
  {
    namePattern: /account|balance|ledger/i,
    suggestedRole: 'core',
    additionalViews: [{ viewType: 'dashboard', purpose: 'analytics' }],
  },
  {
    namePattern: /transaction|transfer|payment/i,
    suggestedRole: 'transaction',
  },
  {
    namePattern: /report|statement/i,
    suggestedRole: 'analytics',
  },
  {
    namePattern: /customer|client|member/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /currency|rate|fee/i,
    suggestedRole: 'master',
  },
]

const commercePatterns: EntityPattern[] = [
  {
    namePattern: /product|item|goods/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /order|cart|checkout/i,
    suggestedRole: 'transaction',
  },
  {
    namePattern: /customer|buyer|member/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /category|brand|tag/i,
    suggestedRole: 'master',
  },
  {
    namePattern: /review|rating|feedback/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /inventory|stock/i,
    suggestedRole: 'core',
    additionalViews: [{ viewType: 'dashboard', purpose: 'overview' }],
  },
  {
    namePattern: /promotion|discount|coupon/i,
    suggestedRole: 'master',
  },
]

const healthcarePatterns: EntityPattern[] = [
  {
    namePattern: /patient|person/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /appointment|visit|schedule/i,
    suggestedRole: 'transaction',
  },
  {
    namePattern: /doctor|provider|physician/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /prescription|medication/i,
    suggestedRole: 'transaction',
  },
  {
    namePattern: /diagnosis|condition|record/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /department|specialty/i,
    suggestedRole: 'master',
  },
]

const saasPatterns: EntityPattern[] = [
  {
    namePattern: /user|account|member/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /organization|tenant|workspace/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /subscription|plan|billing/i,
    suggestedRole: 'transaction',
  },
  {
    namePattern: /setting|config|preference/i,
    suggestedRole: 'config',
  },
  {
    namePattern: /role|permission|access/i,
    suggestedRole: 'master',
  },
  {
    namePattern: /usage|metric|analytics/i,
    suggestedRole: 'analytics',
  },
  {
    namePattern: /feature|module/i,
    suggestedRole: 'master',
  },
]

const logisticsPatterns: EntityPattern[] = [
  {
    namePattern: /shipment|delivery|package/i,
    suggestedRole: 'transaction',
  },
  {
    namePattern: /warehouse|location|facility/i,
    suggestedRole: 'master',
  },
  {
    namePattern: /vehicle|carrier|driver/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /route|trip|journey/i,
    suggestedRole: 'transaction',
  },
  {
    namePattern: /inventory|stock/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /tracking|status/i,
    suggestedRole: 'analytics',
  },
]

const generalPatterns: EntityPattern[] = [
  {
    namePattern: /user|customer|member|person/i,
    suggestedRole: 'core',
  },
  {
    namePattern: /order|request|ticket|task|payment|transaction|transfer/i,
    suggestedRole: 'transaction',
  },
  {
    namePattern: /category|type|status|tag/i,
    suggestedRole: 'master',
  },
  {
    namePattern: /report|dashboard|analytics/i,
    suggestedRole: 'analytics',
  },
  {
    namePattern: /setting|config|preference/i,
    suggestedRole: 'config',
  },
]

export const INDUSTRY_PATTERNS: Record<string, readonly EntityPattern[]> = {
  finance: financePatterns,
  commerce: commercePatterns,
  healthcare: healthcarePatterns,
  saas: saasPatterns,
  logistics: logisticsPatterns,
  general: generalPatterns,
}

// ============================================================================
// Pattern Matching Functions
// ============================================================================

/**
 * Entity 이름에서 역할 추론
 */
export const inferEntityRole = (
  entityName: string,
  industry: string = 'general'
): EntityRole => {
  const patterns = INDUSTRY_PATTERNS[industry] ?? INDUSTRY_PATTERNS.general ?? []

  for (const pattern of patterns) {
    if (pattern.namePattern.test(entityName)) {
      return pattern.suggestedRole
    }
  }

  // Default: core
  return 'core'
}

/**
 * Entity에 대한 추가 View 패턴 가져오기
 */
export const getAdditionalViews = (
  entityName: string,
  industry: string = 'general'
): readonly { viewType: ViewType; purpose: ViewPurpose }[] => {
  const patterns = INDUSTRY_PATTERNS[industry] ?? INDUSTRY_PATTERNS.general ?? []

  for (const pattern of patterns) {
    if (pattern.namePattern.test(entityName) && pattern.additionalViews) {
      return pattern.additionalViews
    }
  }

  return []
}

/**
 * Entity 정보로부터 ViewPlan 생성
 */
export const generateViewPlansForEntity = (
  entity: EntityInfo,
  startPriority: number = 1,
  industry: string = 'general'
): ViewPlan[] => {
  const role = entity.role ?? inferEntityRole(entity.name, industry)
  const baseViews = CRUD_PATTERNS[role]
  const additionalViews = getAdditionalViews(entity.name, industry)

  const allViews = [...baseViews, ...additionalViews]
  const viewPlans: ViewPlan[] = []

  let priority = startPriority

  for (const view of allViews) {
    viewPlans.push({
      viewType: view.viewType,
      purpose: view.purpose,
      entity: entity.name,
      priority: priority++,
      config: {
        title: generateViewTitle(entity.name, view.viewType, view.purpose),
        description: generateViewDescription(entity.name, view.viewType, view.purpose),
      },
    })
  }

  return viewPlans
}

/**
 * 여러 Entity에 대한 전체 ViewPlan 생성
 */
export const generateAllViewPlans = (
  entities: readonly EntityInfo[],
  industry: string = 'general'
): ViewPlan[] => {
  const allPlans: ViewPlan[] = []
  let currentPriority = 1

  for (const entity of entities) {
    const entityPlans = generateViewPlansForEntity(entity, currentPriority, industry)
    allPlans.push(...entityPlans)
    currentPriority += entityPlans.length
  }

  return allPlans
}

// ============================================================================
// Title/Description Generators
// ============================================================================

const generateViewTitle = (
  entityName: string,
  viewType: ViewType,
  purpose: ViewPurpose
): string => {
  const viewTitles: Record<ViewType, Record<ViewPurpose, string>> = {
    list: {
      search: `${entityName} 목록`,
      create: `${entityName} 목록`,
      edit: `${entityName} 목록`,
      view: `${entityName} 목록`,
      analytics: `${entityName} 분석`,
      overview: `${entityName} 개요`,
    },
    form: {
      search: `${entityName} 검색`,
      create: `${entityName} 등록`,
      edit: `${entityName} 수정`,
      view: `${entityName} 상세`,
      analytics: `${entityName} 분석`,
      overview: `${entityName} 개요`,
    },
    detail: {
      search: `${entityName} 검색`,
      create: `${entityName} 등록`,
      edit: `${entityName} 수정`,
      view: `${entityName} 상세`,
      analytics: `${entityName} 분석`,
      overview: `${entityName} 개요`,
    },
    dashboard: {
      search: `${entityName} 대시보드`,
      create: `${entityName} 대시보드`,
      edit: `${entityName} 대시보드`,
      view: `${entityName} 대시보드`,
      analytics: `${entityName} 분석 대시보드`,
      overview: `${entityName} 현황 대시보드`,
    },
    wizard: {
      search: `${entityName} 마법사`,
      create: `${entityName} 생성 마법사`,
      edit: `${entityName} 수정 마법사`,
      view: `${entityName} 마법사`,
      analytics: `${entityName} 마법사`,
      overview: `${entityName} 마법사`,
    },
  }

  return viewTitles[viewType][purpose]
}

const generateViewDescription = (
  entityName: string,
  viewType: ViewType,
  purpose: ViewPurpose
): string => {
  const descriptions: Record<ViewType, Record<ViewPurpose, string>> = {
    list: {
      search: `${entityName} 검색 및 조회`,
      create: `${entityName} 목록 보기`,
      edit: `${entityName} 목록 보기`,
      view: `${entityName} 목록 보기`,
      analytics: `${entityName} 데이터 분석`,
      overview: `${entityName} 전체 현황`,
    },
    form: {
      search: `${entityName} 검색 폼`,
      create: `새 ${entityName} 등록`,
      edit: `${entityName} 정보 수정`,
      view: `${entityName} 상세 보기`,
      analytics: `${entityName} 분석 설정`,
      overview: `${entityName} 개요 설정`,
    },
    detail: {
      search: `${entityName} 검색 결과`,
      create: `${entityName} 등록 완료`,
      edit: `${entityName} 수정 완료`,
      view: `${entityName} 상세 정보`,
      analytics: `${entityName} 분석 결과`,
      overview: `${entityName} 개요`,
    },
    dashboard: {
      search: `${entityName} 검색 대시보드`,
      create: `${entityName} 생성 대시보드`,
      edit: `${entityName} 수정 대시보드`,
      view: `${entityName} 보기 대시보드`,
      analytics: `${entityName} 분석 대시보드`,
      overview: `${entityName} 현황 대시보드`,
    },
    wizard: {
      search: `${entityName} 검색 마법사`,
      create: `${entityName} 생성 단계별 안내`,
      edit: `${entityName} 수정 단계별 안내`,
      view: `${entityName} 보기 마법사`,
      analytics: `${entityName} 분석 마법사`,
      overview: `${entityName} 설정 마법사`,
    },
  }

  return descriptions[viewType][purpose]
}

// ============================================================================
// Common Entity Detection
// ============================================================================

/**
 * 시스템 설명에서 일반적인 Entity 이름 추출 (힌트용)
 */
export const suggestEntitiesFromDescription = (description: string): string[] => {
  const commonEntityKeywords = [
    // Users & People
    { keyword: /고객|customer/i, entity: 'Customer' },
    { keyword: /회원|member|user/i, entity: 'User' },
    { keyword: /직원|employee|staff/i, entity: 'Employee' },
    { keyword: /관리자|admin/i, entity: 'Admin' },

    // Products & Items
    { keyword: /상품|제품|product/i, entity: 'Product' },
    { keyword: /카테고리|category/i, entity: 'Category' },
    { keyword: /브랜드|brand/i, entity: 'Brand' },

    // Orders & Transactions
    { keyword: /주문|order/i, entity: 'Order' },
    { keyword: /결제|payment/i, entity: 'Payment' },
    { keyword: /배송|shipment|delivery/i, entity: 'Shipment' },

    // Business
    { keyword: /계약|contract/i, entity: 'Contract' },
    { keyword: /프로젝트|project/i, entity: 'Project' },
    { keyword: /업무|task/i, entity: 'Task' },

    // Content
    { keyword: /게시글|게시물|post/i, entity: 'Post' },
    { keyword: /댓글|comment/i, entity: 'Comment' },
    { keyword: /문서|document/i, entity: 'Document' },
  ]

  const suggestions: string[] = []

  for (const { keyword, entity } of commonEntityKeywords) {
    if (keyword.test(description) && !suggestions.includes(entity)) {
      suggestions.push(entity)
    }
  }

  return suggestions
}
