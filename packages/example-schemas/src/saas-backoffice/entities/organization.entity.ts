import type { EntitySchema } from '@manifesto-ai/schema'

/**
 * Organization Entity - Multi-tenant workspace
 * Represents a company or team using the SaaS platform
 */
export const organizationEntity: EntitySchema = {
  _type: 'entity',
  id: 'organization',
  version: '1.0.0',
  name: 'Organization',
  description: 'Multi-tenant organization/workspace',
  fields: [
    {
      id: 'id',
      label: 'ID',
      dataType: 'string',
      constraints: [{ type: 'required' }],
    },
    {
      id: 'name',
      label: 'Organization Name',
      dataType: 'string',
      constraints: [
        { type: 'required' },
        { type: 'min', value: 2 },
        { type: 'max', value: 100 },
      ],
    },
    {
      id: 'slug',
      label: 'URL Slug',
      dataType: 'string',
      description: 'Unique identifier for organization URLs',
      constraints: [
        { type: 'required' },
        { type: 'pattern', value: '^[a-z0-9-]+$' },
        { type: 'min', value: 3 },
        { type: 'max', value: 50 },
      ],
    },
    {
      id: 'industry',
      label: 'Industry',
      dataType: 'enum',
      enumValues: [
        { value: 'technology', label: 'Technology' },
        { value: 'finance', label: 'Finance' },
        { value: 'healthcare', label: 'Healthcare' },
        { value: 'education', label: 'Education' },
        { value: 'retail', label: 'Retail' },
        { value: 'manufacturing', label: 'Manufacturing' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      id: 'size',
      label: 'Company Size',
      dataType: 'enum',
      enumValues: [
        { value: '1-10', label: '1-10 employees' },
        { value: '11-50', label: '11-50 employees' },
        { value: '51-200', label: '51-200 employees' },
        { value: '201-1000', label: '201-1000 employees' },
        { value: '1000+', label: '1000+ employees' },
      ],
    },
    {
      id: 'website',
      label: 'Website',
      dataType: 'string',
      constraints: [{ type: 'pattern', value: '^https?://.+' }],
    },
    {
      id: 'logo',
      label: 'Logo URL',
      dataType: 'string',
    },
    {
      id: 'billingEmail',
      label: 'Billing Email',
      dataType: 'string',
      constraints: [
        { type: 'required' },
        { type: 'pattern', value: '^[^@]+@[^@]+\\.[^@]+$' },
      ],
    },
    {
      id: 'status',
      label: 'Status',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'active', label: 'Active' },
        { value: 'trial', label: 'Trial' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'canceled', label: 'Canceled' },
      ],
    },
    {
      id: 'trialEndsAt',
      label: 'Trial End Date',
      dataType: 'date',
      description: 'When the trial period ends',
    },
    {
      id: 'memberCount',
      label: 'Member Count',
      dataType: 'number',
      constraints: [{ type: 'min', value: 1 }],
    },
    {
      id: 'createdAt',
      label: 'Created At',
      dataType: 'datetime',
      constraints: [{ type: 'required' }],
    },
    {
      id: 'updatedAt',
      label: 'Updated At',
      dataType: 'datetime',
      constraints: [{ type: 'required' }],
    },
  ],
}
