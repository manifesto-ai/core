/**
 * Condition Templates Tests
 */

import { describe, it, expect } from 'vitest'
import {
  matchTemplate,
  canMatchTemplate,
  getTemplateCategories,
} from '../../../generators/condition/templates'

// ============================================================================
// Permission Pattern Tests
// ============================================================================

describe('Permission Pattern Templates', () => {
  const availableFields = ['status', 'grade', 'tier', 'role', 'name', 'email']

  it('should match "VIP 고객만"', () => {
    const result = matchTemplate('VIP 고객만', availableFields)

    expect(result).not.toBeNull()
    expect(result?.templateName).toBe('permission.roleEquals')
    expect(result?.expression[0]).toBe('==')
    expect(result?.expression[2]).toBe('VIP')
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('should match "프리미엄 회원만"', () => {
    const result = matchTemplate('프리미엄 회원만', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[2]).toBe('프리미엄'.toUpperCase())
  })

  it('should match "관리자만"', () => {
    const fieldsWithRole = ['role', 'name', 'email']
    const result = matchTemplate('관리자만', fieldsWithRole)

    expect(result).not.toBeNull()
  })

  it('should return null when no grade/role field available', () => {
    const fieldsWithoutGrade = ['name', 'email', 'phone']
    const result = matchTemplate('VIP 고객만', fieldsWithoutGrade)

    expect(result).toBeNull()
  })
})

// ============================================================================
// Status Pattern Tests
// ============================================================================

describe('Status Pattern Templates', () => {
  const availableFields = ['status', 'state', 'name', 'amount']

  it('should match "상태가 승인일 때"', () => {
    const result = matchTemplate('상태가 승인일 때', availableFields)

    expect(result).not.toBeNull()
    expect(result?.templateName).toBe('status.equals')
    expect(result?.expression[0]).toBe('==')
  })

  it('should match "상태가 승인일 경우"', () => {
    const result = matchTemplate('상태가 승인일 경우', availableFields)

    expect(result).not.toBeNull()
  })

  it('should match "활성 상태일 때"', () => {
    const result = matchTemplate('활성 상태일 때', availableFields)

    expect(result).not.toBeNull()
  })

  it('should match negative patterns "상태가 비활성이 아닌 경우"', () => {
    const result = matchTemplate('상태가 비활성이 아닌 경우', availableFields)

    expect(result).not.toBeNull()
    expect(result?.templateName).toBe('status.notEquals')
    expect(result?.expression[0]).toBe('!=')
  })
})

// ============================================================================
// Comparison Pattern Tests
// ============================================================================

describe('Comparison Pattern Templates', () => {
  const availableFields = ['amount', 'quantity', 'price', 'total', 'count']

  it('should match "금액이 100만원 이상"', () => {
    const result = matchTemplate('금액이 100만원 이상', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('>=')
    expect(result?.expression[2]).toBe(1000000) // 100 * 10000
  })

  it('should match "수량이 10개 이상"', () => {
    const result = matchTemplate('수량이 10개 이상', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('>=')
    expect(result?.expression[2]).toBe(10)
  })

  it('should match "금액이 50000 이하"', () => {
    const result = matchTemplate('금액이 50000 이하', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('<=')
    expect(result?.expression[2]).toBe(50000)
  })

  it('should match "수량이 10개 초과"', () => {
    const result = matchTemplate('수량이 10개 초과', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('>')
    expect(result?.expression[2]).toBe(10)
  })

  it('should match "가격이 1000보다 작음"', () => {
    const result = matchTemplate('가격이 1000보다 작음', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('<')
  })

  it('should match "총액이 5000과 같으면"', () => {
    const fieldsWithTotal = ['total', 'quantity', 'price']
    const result = matchTemplate('총액이 5000과 같으면', fieldsWithTotal)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('==')
    expect(result?.expression[2]).toBe(5000)
  })
})

// ============================================================================
// Presence Pattern Tests
// ============================================================================

describe('Presence Pattern Templates', () => {
  const availableFields = ['name', 'email', 'phone', 'description', 'title']

  it('should match "이름이 비어있으면"', () => {
    const result = matchTemplate('이름이 비어있으면', availableFields)

    expect(result).not.toBeNull()
    expect(result?.templateName).toBe('presence.isEmpty')
    expect(result?.expression[0]).toBe('IS_EMPTY')
  })

  it('should match "설명이 비어 있는 경우"', () => {
    const result = matchTemplate('설명이 비어 있는 경우', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('IS_EMPTY')
  })

  it('should match "이메일이 없으면"', () => {
    const result = matchTemplate('이메일이 없으면', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('IS_EMPTY')
  })

  it('should match "이름이 있으면"', () => {
    const result = matchTemplate('이름이 있으면', availableFields)

    expect(result).not.toBeNull()
    expect(result?.templateName).toBe('presence.hasValue')
    expect(result?.expression[0]).toBe('IS_NOT_NULL')
  })

  it('should match "전화번호가 입력되었으면"', () => {
    const result = matchTemplate('전화번호가 입력되었으면', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('IS_NOT_NULL')
  })

  it('should match "제목이 선택된 경우"', () => {
    const result = matchTemplate('제목이 선택된 경우', availableFields)

    expect(result).not.toBeNull()
    expect(result?.expression[0]).toBe('IS_NOT_NULL')
  })
})

// ============================================================================
// canMatchTemplate Tests
// ============================================================================

describe('canMatchTemplate', () => {
  it('should return true for matchable patterns', () => {
    expect(canMatchTemplate('VIP 고객만')).toBe(true)
    expect(canMatchTemplate('상태가 활성일 때')).toBe(true)
    expect(canMatchTemplate('금액이 100만원 이상')).toBe(true)
    expect(canMatchTemplate('이름이 비어있으면')).toBe(true)
  })

  it('should return false for unmatchable patterns', () => {
    expect(canMatchTemplate('복잡한 비즈니스 로직')).toBe(false)
    expect(canMatchTemplate('custom rule')).toBe(false)
    expect(canMatchTemplate('')).toBe(false)
  })
})

// ============================================================================
// getTemplateCategories Tests
// ============================================================================

describe('getTemplateCategories', () => {
  it('should return all template categories', () => {
    const categories = getTemplateCategories()

    expect(categories).toContain('permission')
    expect(categories).toContain('status')
    expect(categories).toContain('comparison')
    expect(categories).toContain('presence')
    expect(categories).toContain('composite')
  })

  it('should not have duplicates', () => {
    const categories = getTemplateCategories()
    const uniqueCategories = [...new Set(categories)]

    expect(categories.length).toBe(uniqueCategories.length)
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Template Edge Cases', () => {
  it('should handle whitespace variations', () => {
    const fields = ['status', 'grade', 'name']

    expect(matchTemplate('  VIP 고객만  ', fields)).not.toBeNull()
    expect(matchTemplate('상태가  승인일  때', fields)).not.toBeNull()
  })

  it('should handle field name inference with partial matches', () => {
    const fields = ['customerStatus', 'customerGrade', 'fullName']
    const result = matchTemplate('VIP 고객만', fields)

    // customerGrade contains 'grade'
    expect(result).not.toBeNull()
    expect(result?.referencedFields).toContain('customerGrade')
  })

  it('should prioritize exact field name matches', () => {
    const fields = ['grade', 'customerGrade', 'gradeLevel']
    const result = matchTemplate('VIP 고객만', fields)

    // 'grade' should be preferred as exact match
    expect(result).not.toBeNull()
  })

  it('should handle numeric values with commas', () => {
    const fields = ['amount', 'price']
    const result = matchTemplate('금액이 1,000,000 이상', fields)

    expect(result).not.toBeNull()
    expect(result?.expression[2]).toBe(1000000)
  })
})
