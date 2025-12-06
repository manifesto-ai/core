/**
 * @manifesto-ai/example-schemas
 *
 * Example schemas demonstrating the Manifesto schema system
 */

// Legacy schemas (using builder API - compatible with current system)
export * from './product.entity'
export * from './product-create.view'
export * from './products-list.view'
export * from './delivery-register.entity'
export * from './delivery-register.view'
export * from './alert-rule.entity'
export * from './alert-rule.view'
export * from './user-edit.entity'
export * from './user-edit.view'
export * from './schedule.entity'
export * from './schedule.view'
export * from './validation-demo.entity'
export * from './validation-demo.view'
export * from './complex-conditions.entity'
export * from './complex-conditions.view'
export * from './customer-onboarding.entity'
export * from './customer-onboarding.view'

// SaaS Backoffice - Entity and View schemas
export * from './saas-backoffice/entities'
export * from './saas-backoffice/views'

// Storybook utilities (test helpers)
export * from './storybook'
