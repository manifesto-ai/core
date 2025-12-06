/**
 * Customer Onboarding Entity Schema
 *
 * SaaS 고객 온보딩 폼 - 실제 서비스에서 사용되는 복합 조건 시나리오
 *
 * 주요 분기:
 * - 계정 유형: 개인 / 기업
 * - 구독 플랜: Free / Pro / Enterprise
 * - 결제 주기: 월간 / 연간
 */

import { entity, field, enumValue } from '@manifesto-ai/schema'

// 계정 유형
export const accountTypes = [
  enumValue('PERSONAL', 'Personal'),
  enumValue('BUSINESS', 'Business'),
] as const

// 구독 플랜
export const subscriptionPlans = [
  enumValue('FREE', 'Free'),
  enumValue('PRO', 'Pro'),
  enumValue('ENTERPRISE', 'Enterprise'),
] as const

// 결제 주기
export const billingCycles = [
  enumValue('MONTHLY', 'Monthly'),
  enumValue('ANNUAL', 'Annual (20% off)'),
] as const

// 팀 규모
export const teamSizes = [
  enumValue('SMALL', '1-10'),
  enumValue('MEDIUM', '11-50'),
  enumValue('LARGE', '51-200'),
  enumValue('XLARGE', '200+'),
] as const

// 산업 분야
export const industries = [
  enumValue('TECH', 'Technology'),
  enumValue('FINANCE', 'Finance'),
  enumValue('HEALTHCARE', 'Healthcare'),
  enumValue('RETAIL', 'Retail'),
  enumValue('OTHER', 'Other'),
] as const

// Entity Schema
export const customerOnboardingEntity = entity(
  'customerOnboarding',
  'Customer Onboarding',
  '1.0.0'
)
  .description('SaaS 고객 온보딩 폼')
  .tags('saas', 'onboarding', 'subscription')
  .fields(
    // =========================================================================
    // 기본 정보
    // =========================================================================
    field
      .enum('accountType', 'Account Type', accountTypes)
      .required()
      .build(),

    field
      .string('email', 'Email')
      .required()
      .pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', 'Invalid email format')
      .build(),

    field.string('fullName', 'Full Name').required().min(2).build(),

    // =========================================================================
    // 기업 계정 전용 필드
    // =========================================================================
    field.string('companyName', 'Company Name').min(2).build(),

    field.string('jobTitle', 'Job Title').build(),

    field
      .enum('teamSize', 'Team Size', teamSizes)
      .build(),

    field
      .enum('industry', 'Industry', industries)
      .build(),

    field.string('taxId', 'Tax ID / VAT Number').build(),

    // =========================================================================
    // 구독 플랜
    // =========================================================================
    field
      .enum('plan', 'Subscription Plan', subscriptionPlans)
      .required()
      .defaultValue('FREE')
      .build(),

    field
      .enum('billingCycle', 'Billing Cycle', billingCycles)
      .defaultValue('MONTHLY')
      .build(),

    // =========================================================================
    // Pro 플랜 전용
    // =========================================================================
    field.number('seats', 'Number of Seats').min(1).max(100).build(),

    field.boolean('prioritySupport', 'Priority Support').build(),

    // =========================================================================
    // Enterprise 플랜 전용
    // =========================================================================
    field.boolean('ssoEnabled', 'Enable SSO').build(),

    field.boolean('auditLogs', 'Audit Logs').build(),

    field.boolean('dedicatedManager', 'Dedicated Account Manager').build(),

    field.string('customDomain', 'Custom Domain').build(),

    // =========================================================================
    // 결제 정보 (유료 플랜)
    // =========================================================================
    field.string('cardNumber', 'Card Number').build(),

    field.string('expiryDate', 'Expiry Date').build(),

    field.string('cvv', 'CVV').build(),

    // =========================================================================
    // Enterprise + 연간 결제 시 추가 할인
    // =========================================================================
    field.string('couponCode', 'Coupon Code').build(),

    // =========================================================================
    // 약관 동의
    // =========================================================================
    field.boolean('termsAccepted', 'Terms Accepted').required().build(),

    field.boolean('marketingConsent', 'Marketing Consent').build()
  )
  .build()

export type AccountType = (typeof accountTypes)[number]['value']
export type SubscriptionPlan = (typeof subscriptionPlans)[number]['value']
export type BillingCycle = (typeof billingCycles)[number]['value']
export type TeamSize = (typeof teamSizes)[number]['value']
export type Industry = (typeof industries)[number]['value']
