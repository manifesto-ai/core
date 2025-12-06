/**
 * Example schemas for the Playground
 *
 * Imports schemas from @manifesto-ai/example-schemas and exports them as JSON
 * for the Monaco editor
 */

import {
  // SaaS Backoffice - Entities
  organizationEntity,
  userEntity,
  subscriptionEntity,
  apiKeyEntity,
  settingsEntity,
  // SaaS Backoffice - Views
  organizationCreateView,
  userInviteView,
  subscriptionWizardView,
  apiKeyCreateView,
  settingsEditView,
  // Legacy examples
  customerOnboardingEntity,
  customerOnboardingView,
  complexConditionsEntity,
  complexConditionsView,
} from '@manifesto-ai/example-schemas'

export interface ExampleSchema {
  id: string
  name: string
  description: string
  entity: unknown
  view: unknown
}

export const EXAMPLE_SCHEMAS: ExampleSchema[] = [
  // SaaS Backoffice Examples
  {
    id: 'organization-create',
    name: 'Organization Setup',
    description: 'Multi-tenant organization creation form',
    entity: organizationEntity,
    view: organizationCreateView,
  },
  {
    id: 'user-invite',
    name: 'User Invite',
    description: 'Team member invitation with MFA config - conditional fields demo',
    entity: userEntity,
    view: userInviteView,
  },
  {
    id: 'subscription-wizard',
    name: 'Subscription Wizard',
    description: 'Plan selection with billing & payment - multi-step conditional sections',
    entity: subscriptionEntity,
    view: subscriptionWizardView,
  },
  {
    id: 'api-key-create',
    name: 'API Key Generator',
    description: 'API key creation with scopes & IP restrictions',
    entity: apiKeyEntity,
    view: apiKeyCreateView,
  },
  {
    id: 'settings-edit',
    name: 'Organization Settings',
    description: 'Complex settings form - integrations, notifications, branding',
    entity: settingsEntity,
    view: settingsEditView,
  },
  // Other Examples
  {
    id: 'customer-onboarding',
    name: 'Customer Onboarding',
    description: 'SaaS signup form - Personal/Business account, Pro/Enterprise plans',
    entity: customerOnboardingEntity,
    view: customerOnboardingView,
  },
  {
    id: 'complex-conditions',
    name: 'Complex Conditions',
    description: 'AND/OR/nested conditions demo - product type & payment branches',
    entity: complexConditionsEntity,
    view: complexConditionsView,
  },
]

export function getExampleSchema(id: string): ExampleSchema | undefined {
  return EXAMPLE_SCHEMAS.find((s) => s.id === id)
}
