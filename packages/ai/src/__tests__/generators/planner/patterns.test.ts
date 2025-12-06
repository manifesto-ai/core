/**
 * Planner Patterns Tests
 */

import { describe, it, expect } from 'vitest'
import {
  inferEntityRole,
  getAdditionalViews,
  generateViewPlansForEntity,
  suggestEntitiesFromDescription,
  INDUSTRY_PATTERNS,
} from '../../../generators/planner/patterns'
import type { EntityInfo } from '../../../core/schemas/view-plan.schema'

// ============================================================================
// inferEntityRole Tests
// ============================================================================

describe('inferEntityRole', () => {
  it('should infer core role for customer-like entities', () => {
    expect(inferEntityRole('Customer')).toBe('core')
    expect(inferEntityRole('User')).toBe('core')
    expect(inferEntityRole('Member')).toBe('core')
  })

  it('should infer transaction role for order-like entities', () => {
    expect(inferEntityRole('Order')).toBe('transaction')
    expect(inferEntityRole('Payment')).toBe('transaction')
    expect(inferEntityRole('Transaction')).toBe('transaction')
  })

  it('should infer master role for category-like entities', () => {
    expect(inferEntityRole('Category')).toBe('master')
    expect(inferEntityRole('Status')).toBe('master')
    expect(inferEntityRole('Tag')).toBe('master')
  })

  it('should infer analytics role for report-like entities', () => {
    expect(inferEntityRole('Report')).toBe('analytics')
    expect(inferEntityRole('Dashboard')).toBe('analytics')
    expect(inferEntityRole('Analytics')).toBe('analytics')
  })

  it('should infer config role for settings-like entities', () => {
    expect(inferEntityRole('Setting')).toBe('config')
    expect(inferEntityRole('Config')).toBe('config')
    expect(inferEntityRole('Preference')).toBe('config')
  })

  it('should default to core for unknown entities', () => {
    expect(inferEntityRole('UnknownEntity')).toBe('core')
    expect(inferEntityRole('SomeThing')).toBe('core')
  })

  it('should use industry-specific patterns', () => {
    // Finance
    expect(inferEntityRole('Account', 'finance')).toBe('core')
    expect(inferEntityRole('Ledger', 'finance')).toBe('core')

    // Commerce
    expect(inferEntityRole('Product', 'commerce')).toBe('core')
    expect(inferEntityRole('Cart', 'commerce')).toBe('transaction')

    // Healthcare
    expect(inferEntityRole('Patient', 'healthcare')).toBe('core')
    expect(inferEntityRole('Appointment', 'healthcare')).toBe('transaction')
  })
})

// ============================================================================
// getAdditionalViews Tests
// ============================================================================

describe('getAdditionalViews', () => {
  it('should return additional views for finance accounts', () => {
    const additionalViews = getAdditionalViews('Account', 'finance')

    expect(additionalViews.length).toBeGreaterThan(0)
    const hasDashboard = additionalViews.some(v => v.viewType === 'dashboard')
    expect(hasDashboard).toBe(true)
  })

  it('should return additional views for commerce inventory', () => {
    const additionalViews = getAdditionalViews('Inventory', 'commerce')

    expect(additionalViews.length).toBeGreaterThan(0)
  })

  it('should return empty array for entities without additional views', () => {
    const additionalViews = getAdditionalViews('Customer', 'general')

    expect(additionalViews).toEqual([])
  })
})

// ============================================================================
// generateViewPlansForEntity Tests
// ============================================================================

describe('generateViewPlansForEntity', () => {
  it('should generate views for core entity', () => {
    const entity: EntityInfo = {
      name: 'Customer',
      description: '고객',
      role: 'core',
    }

    const viewPlans = generateViewPlansForEntity(entity)

    expect(viewPlans.length).toBe(4) // list, form(create), form(edit), detail
    expect(viewPlans.every(p => p.entity === 'Customer')).toBe(true)
  })

  it('should generate views for transaction entity', () => {
    const entity: EntityInfo = {
      name: 'Order',
      description: '주문',
      role: 'transaction',
    }

    const viewPlans = generateViewPlansForEntity(entity)

    expect(viewPlans.length).toBe(3) // list, wizard, detail
    const viewTypes = viewPlans.map(p => p.viewType)
    expect(viewTypes).toContain('wizard')
    expect(viewTypes).not.toContain('form')
  })

  it('should generate views for master entity', () => {
    const entity: EntityInfo = {
      name: 'Category',
      description: '카테고리',
      role: 'master',
    }

    const viewPlans = generateViewPlansForEntity(entity)

    expect(viewPlans.length).toBe(3) // list, form(create), form(edit)
    const viewTypes = viewPlans.map(p => p.viewType)
    expect(viewTypes).not.toContain('detail')
  })

  it('should generate views for analytics entity', () => {
    const entity: EntityInfo = {
      name: 'Report',
      description: '리포트',
      role: 'analytics',
    }

    const viewPlans = generateViewPlansForEntity(entity)

    expect(viewPlans.length).toBe(2) // dashboard, list
    const viewTypes = viewPlans.map(p => p.viewType)
    expect(viewTypes).toContain('dashboard')
  })

  it('should generate views for config entity', () => {
    const entity: EntityInfo = {
      name: 'Settings',
      description: '설정',
      role: 'config',
    }

    const viewPlans = generateViewPlansForEntity(entity)

    expect(viewPlans.length).toBe(1) // form(edit) only
    expect(viewPlans[0].viewType).toBe('form')
    expect(viewPlans[0].purpose).toBe('edit')
  })

  it('should use startPriority parameter', () => {
    const entity: EntityInfo = {
      name: 'Customer',
      description: '고객',
      role: 'core',
    }

    const viewPlans = generateViewPlansForEntity(entity, 10)

    expect(viewPlans[0].priority).toBe(10)
    expect(viewPlans[1].priority).toBe(11)
  })

  it('should generate title and description', () => {
    const entity: EntityInfo = {
      name: 'Product',
      description: '상품',
      role: 'core',
    }

    const viewPlans = generateViewPlansForEntity(entity)

    expect(viewPlans[0].config?.title).toBeDefined()
    expect(viewPlans[0].config?.description).toBeDefined()
  })
})

// ============================================================================
// suggestEntitiesFromDescription Tests
// ============================================================================

describe('suggestEntitiesFromDescription', () => {
  it('should suggest entities from Korean description', () => {
    const entities = suggestEntitiesFromDescription('고객과 상품을 관리하는 주문 시스템')

    expect(entities).toContain('Customer')
    expect(entities).toContain('Product')
    expect(entities).toContain('Order')
  })

  it('should suggest entities from English description', () => {
    const entities = suggestEntitiesFromDescription('customer management system with orders')

    expect(entities).toContain('Customer')
    expect(entities).toContain('Order')
  })

  it('should not include duplicates', () => {
    const entities = suggestEntitiesFromDescription('고객 관리, customer support, 고객 서비스')

    const customerCount = entities.filter(e => e === 'Customer').length
    expect(customerCount).toBe(1)
  })

  it('should return empty array for no matches', () => {
    const entities = suggestEntitiesFromDescription('단순한 설명 없는 시스템')

    expect(entities).toEqual([])
  })

  it('should suggest multiple related entities', () => {
    const entities = suggestEntitiesFromDescription(
      '직원이 프로젝트와 업무를 관리하는 시스템'
    )

    expect(entities).toContain('Employee')
    expect(entities).toContain('Project')
    expect(entities).toContain('Task')
  })
})

// ============================================================================
// Industry Patterns Tests
// ============================================================================

describe('INDUSTRY_PATTERNS', () => {
  it('should have patterns for all supported industries', () => {
    expect(INDUSTRY_PATTERNS.finance).toBeDefined()
    expect(INDUSTRY_PATTERNS.commerce).toBeDefined()
    expect(INDUSTRY_PATTERNS.healthcare).toBeDefined()
    expect(INDUSTRY_PATTERNS.saas).toBeDefined()
    expect(INDUSTRY_PATTERNS.logistics).toBeDefined()
    expect(INDUSTRY_PATTERNS.general).toBeDefined()
  })

  it('should have valid pattern structure', () => {
    for (const patterns of Object.values(INDUSTRY_PATTERNS)) {
      for (const pattern of patterns) {
        expect(pattern.namePattern).toBeInstanceOf(RegExp)
        expect(pattern.suggestedRole).toBeDefined()
      }
    }
  })
})
