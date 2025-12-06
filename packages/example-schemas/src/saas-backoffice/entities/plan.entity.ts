import type { EntitySchema } from '@manifesto-ai/schema'

/**
 * Plan Entity - Subscription plan definitions
 * Defines pricing tiers (Free, Pro, Enterprise)
 */
export const planEntity: EntitySchema = {
  _type: 'entity',
  id: 'plan',
  version: '1.0.0',
  name: 'Plan',
  description: 'Subscription plan definitions',
  fields: [
    { id: 'id', label: 'ID', dataType: 'string', constraints: [{ type: 'required' }] },
    { id: 'name', label: 'Plan Name', dataType: 'string', constraints: [{ type: 'required' }, { type: 'min', value: 2 }, { type: 'max', value: 50 }] },
    { id: 'slug', label: 'Slug', dataType: 'string', description: 'URL-friendly identifier', constraints: [{ type: 'required' }] },
    { id: 'description', label: 'Description', dataType: 'string', constraints: [{ type: 'max', value: 500 }] },
    {
      id: 'tier',
      label: 'Tier',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'free', label: 'Free' },
        { value: 'starter', label: 'Starter' },
        { value: 'pro', label: 'Pro' },
        { value: 'enterprise', label: 'Enterprise' },
      ],
    },
    { id: 'isEnterprise', label: 'Is Enterprise', dataType: 'boolean', description: 'Enterprise plans have custom pricing', constraints: [{ type: 'required' }] },
    { id: 'monthlyPrice', label: 'Monthly Price (per seat)', dataType: 'number', description: 'Not applicable for enterprise plans', constraints: [{ type: 'min', value: 0 }] },
    { id: 'annualPrice', label: 'Annual Price (per seat)', dataType: 'number', description: 'Not applicable for enterprise plans', constraints: [{ type: 'min', value: 0 }] },
    { id: 'maxSeats', label: 'Max Seats', dataType: 'number', description: 'Maximum seats allowed, null for unlimited', constraints: [{ type: 'min', value: 1 }] },
    { id: 'maxStorage', label: 'Max Storage (GB)', dataType: 'number', constraints: [{ type: 'min', value: 0 }] },
    { id: 'maxApiCalls', label: 'Max API Calls (monthly)', dataType: 'number', description: 'Monthly API call limit, null for unlimited' },
    { id: 'features', label: 'Included Features', dataType: 'string', description: 'Comma-separated list of feature IDs' },
    { id: 'isActive', label: 'Is Active', dataType: 'boolean', constraints: [{ type: 'required' }] },
    { id: 'sortOrder', label: 'Sort Order', dataType: 'number', description: 'Display order on pricing page', constraints: [{ type: 'required' }] },
    { id: 'createdAt', label: 'Created At', dataType: 'datetime', constraints: [{ type: 'required' }] },
    { id: 'updatedAt', label: 'Updated At', dataType: 'datetime', constraints: [{ type: 'required' }] },
  ],
}
