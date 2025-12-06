import type { EntitySchema } from '@manifesto-ai/schema'

/**
 * Feature Entity - Feature flags and entitlements
 * Controls feature access based on plan and organization settings
 */
export const featureEntity: EntitySchema = {
  _type: 'entity',
  id: 'feature',
  version: '1.0.0',
  name: 'Feature',
  description: 'Feature flags and entitlements management',
  fields: [
    { id: 'id', label: 'ID', dataType: 'string', constraints: [{ type: 'required' }] },
    { id: 'key', label: 'Feature Key', dataType: 'string', description: 'Unique identifier used in code', constraints: [{ type: 'required' }, { type: 'pattern', value: '^[a-z][a-z0-9_]*$' }, { type: 'min', value: 2 }, { type: 'max', value: 50 }] },
    { id: 'name', label: 'Display Name', dataType: 'string', constraints: [{ type: 'required' }, { type: 'min', value: 2 }, { type: 'max', value: 100 }] },
    { id: 'description', label: 'Description', dataType: 'string', constraints: [{ type: 'max', value: 500 }] },
    {
      id: 'category',
      label: 'Category',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'core', label: 'Core' },
        { value: 'analytics', label: 'Analytics' },
        { value: 'integrations', label: 'Integrations' },
        { value: 'security', label: 'Security' },
        { value: 'collaboration', label: 'Collaboration' },
        { value: 'automation', label: 'Automation' },
      ],
    },
    {
      id: 'type',
      label: 'Feature Type',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'boolean', label: 'Boolean (on/off)' },
        { value: 'limit', label: 'Limit (numeric)' },
        { value: 'tier', label: 'Tier-based' },
      ],
    },
    { id: 'defaultValue', label: 'Default Value', dataType: 'string', description: 'Default value for boolean or limit features' },
    {
      id: 'minTier',
      label: 'Minimum Tier',
      dataType: 'enum',
      description: 'Minimum plan tier required for this feature',
      enumValues: [
        { value: 'free', label: 'Free' },
        { value: 'starter', label: 'Starter' },
        { value: 'pro', label: 'Pro' },
        { value: 'enterprise', label: 'Enterprise' },
      ],
    },
    { id: 'isPublic', label: 'Is Public', dataType: 'boolean', description: 'Show on pricing page', constraints: [{ type: 'required' }] },
    { id: 'isBeta', label: 'Is Beta', dataType: 'boolean', description: 'Mark as beta feature', constraints: [{ type: 'required' }] },
    { id: 'betaEndsAt', label: 'Beta End Date', dataType: 'date' },
    { id: 'isEnabled', label: 'Is Enabled', dataType: 'boolean', description: 'Global feature toggle', constraints: [{ type: 'required' }] },
    { id: 'rolloutPercent', label: 'Rollout Percentage', dataType: 'number', description: 'Gradual rollout percentage (0-100)', constraints: [{ type: 'min', value: 0 }, { type: 'max', value: 100 }] },
    { id: 'createdAt', label: 'Created At', dataType: 'datetime', constraints: [{ type: 'required' }] },
    { id: 'updatedAt', label: 'Updated At', dataType: 'datetime', constraints: [{ type: 'required' }] },
  ],
}
