/**
 * Customer Onboarding View Schema
 *
 * SaaS 고객 온보딩 폼 화면 정의
 *
 * 조건부 렌더링:
 * - Business 계정 선택 시 기업 정보 섹션 표시
 * - Pro/Enterprise 플랜 선택 시 결제 정보 표시
 * - Enterprise 플랜 선택 시 추가 옵션 표시
 * - Enterprise + Annual 선택 시 쿠폰 코드 표시
 */

import {
  view,
  section,
  layout,
  header,
  footer,
  viewAction,
  viewField,
  fieldEquals,
} from '@manifesto-ai/schema'

// View Schema
export const customerOnboardingView = view(
  'customer-onboarding',
  'Customer Onboarding',
  '1.0.0'
)
  .entityRef('customerOnboarding')
  .mode('create')
  .description('SaaS 고객 온보딩 폼')
  .layout(layout.form(2))
  .header(
    header('Create Your Account', {
      subtitle: 'Get started with your new workspace',
    })
  )
  .sections(
    // =========================================================================
    // 계정 유형 선택
    // =========================================================================
    section('account-type')
      .title('Account Type')
      .description('Choose your account type')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .select('accountType', 'accountType')
          .label('Account Type')
          .helpText('Business accounts get additional features')
          .build()
      )
      .build(),

    // =========================================================================
    // 기본 정보
    // =========================================================================
    section('basic-info')
      .title('Basic Information')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('email', 'email')
          .label('Email Address')
          .placeholder('you@example.com')
          .build(),

        viewField
          .textInput('fullName', 'fullName')
          .label('Full Name')
          .placeholder('John Doe')
          .build()
      )
      .build(),

    // =========================================================================
    // 기업 정보 (Business 계정만)
    // =========================================================================
    section('business-info')
      .title('Company Information')
      .description('Tell us about your organization')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('accountType', 'BUSINESS'))
      .fields(
        viewField
          .textInput('companyName', 'companyName')
          .label('Company Name')
          .placeholder('Acme Inc.')
          .build(),

        viewField
          .textInput('jobTitle', 'jobTitle')
          .label('Your Role')
          .placeholder('Product Manager')
          .build(),

        viewField
          .select('teamSize', 'teamSize')
          .label('Team Size')
          .build(),

        viewField
          .select('industry', 'industry')
          .label('Industry')
          .build(),

        viewField
          .textInput('taxId', 'taxId')
          .label('Tax ID / VAT Number')
          .placeholder('Optional')
          .helpText('Required for invoicing')
          .build()
      )
      .build(),

    // =========================================================================
    // 구독 플랜 선택
    // =========================================================================
    section('plan-selection')
      .title('Choose Your Plan')
      .description('Select a plan that fits your needs')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .select('plan', 'plan')
          .label('Subscription Plan')
          .helpText('You can upgrade anytime')
          .build(),

        viewField
          .select('billingCycle', 'billingCycle')
          .label('Billing Cycle')
          .helpText('Annual billing saves 20%')
          .build()
      )
      .build(),

    // =========================================================================
    // Pro 플랜 옵션
    // =========================================================================
    section('pro-options')
      .title('Pro Features')
      .description('Customize your Pro subscription')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('plan', 'PRO'))
      .fields(
        viewField
          .numberInput('seats', 'seats')
          .label('Number of Seats')
          .placeholder('5')
          .helpText('$10/seat/month')
          .build(),

        viewField
          .checkbox('prioritySupport', 'prioritySupport')
          .label('Priority Support')
          .helpText('24/7 priority email support')
          .build()
      )
      .build(),

    // =========================================================================
    // Enterprise 플랜 옵션
    // =========================================================================
    section('enterprise-options')
      .title('Enterprise Features')
      .description('Advanced security and compliance')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('plan', 'ENTERPRISE'))
      .fields(
        viewField
          .checkbox('ssoEnabled', 'ssoEnabled')
          .label('Single Sign-On (SSO)')
          .helpText('SAML 2.0 and OAuth support')
          .build(),

        viewField
          .checkbox('auditLogs', 'auditLogs')
          .label('Audit Logs')
          .helpText('Detailed activity tracking')
          .build(),

        viewField
          .checkbox('dedicatedManager', 'dedicatedManager')
          .label('Dedicated Account Manager')
          .helpText('Personal point of contact')
          .build(),

        viewField
          .textInput('customDomain', 'customDomain')
          .label('Custom Domain')
          .placeholder('app.yourcompany.com')
          .helpText('Use your own domain')
          .build()
      )
      .build(),

    // =========================================================================
    // 결제 정보 (유료 플랜만)
    // =========================================================================
    section('payment-info')
      .title('Payment Information')
      .description('Secure payment processing')
      .layout(layout.grid(3, '1rem'))
      .visible(['OR', fieldEquals('plan', 'PRO'), fieldEquals('plan', 'ENTERPRISE')])
      .fields(
        viewField
          .textInput('cardNumber', 'cardNumber')
          .label('Card Number')
          .placeholder('4242 4242 4242 4242')
          .build(),

        viewField
          .textInput('expiryDate', 'expiryDate')
          .label('Expiry Date')
          .placeholder('MM/YY')
          .build(),

        viewField
          .textInput('cvv', 'cvv')
          .label('CVV')
          .placeholder('123')
          .build()
      )
      .build(),

    // =========================================================================
    // 특별 할인 (Enterprise + Annual)
    // =========================================================================
    section('special-discount')
      .title('Special Offer')
      .description('Enterprise annual subscribers get exclusive benefits')
      .layout(layout.grid(1, '1rem'))
      .visible([
        'AND',
        fieldEquals('plan', 'ENTERPRISE'),
        fieldEquals('billingCycle', 'ANNUAL'),
      ])
      .fields(
        viewField
          .textInput('couponCode', 'couponCode')
          .label('Coupon Code')
          .placeholder('Enter your coupon code')
          .helpText('Have a coupon? Apply it here for additional savings')
          .build()
      )
      .build(),

    // =========================================================================
    // 약관 동의
    // =========================================================================
    section('terms')
      .title('Terms & Conditions')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .checkbox('termsAccepted', 'termsAccepted')
          .label('I agree to the Terms of Service and Privacy Policy')
          .build(),

        viewField
          .checkbox('marketingConsent', 'marketingConsent')
          .label('Send me product updates and tips')
          .helpText('You can unsubscribe anytime')
          .build()
      )
      .build()
  )
  .footer(
    footer([
      viewAction.cancel('cancel', 'Cancel').build(),
      viewAction.submit('submit', 'Create Account').build(),
    ])
  )
  .build()
