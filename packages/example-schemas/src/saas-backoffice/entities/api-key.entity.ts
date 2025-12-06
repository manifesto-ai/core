import type { EntitySchema } from '@manifesto-ai/schema'

/**
 * ApiKey Entity - API key management
 * Secure access tokens with scopes and IP restrictions
 */
export const apiKeyEntity: EntitySchema = {
  _type: 'entity',
  id: 'apiKey',
  version: '1.0.0',
  name: 'API Key',
  description: 'API key management with scopes and restrictions',
  fields: [
    { id: 'id', label: 'ID', dataType: 'string', constraints: [{ type: 'required' }] },
    { id: 'name', label: 'Key Name', dataType: 'string', description: 'Human-readable name for identification', constraints: [{ type: 'required' }, { type: 'min', value: 2 }, { type: 'max', value: 100 }] },
    { id: 'keyPrefix', label: 'Key Prefix', dataType: 'string', description: 'First 8 characters of the key for identification', constraints: [{ type: 'required' }] },
    { id: 'keyHash', label: 'Key Hash', dataType: 'string', description: 'Hashed key value (never shown)', constraints: [{ type: 'required' }] },
    { id: 'organizationId', label: 'Organization ID', dataType: 'string', constraints: [{ type: 'required' }] },
    { id: 'createdById', label: 'Created By', dataType: 'string', description: 'User ID who created this key', constraints: [{ type: 'required' }] },
    {
      id: 'scopes',
      label: 'Scopes',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'read', label: 'Read Only' },
        { value: 'write', label: 'Read & Write' },
        { value: 'admin', label: 'Admin (Full Access)' },
      ],
    },
    {
      id: 'environment',
      label: 'Environment',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'production', label: 'Production' },
        { value: 'staging', label: 'Staging' },
        { value: 'development', label: 'Development' },
      ],
    },
    { id: 'ipRestrictions', label: 'IP Restrictions', dataType: 'string', description: 'Comma-separated list of allowed IPs or CIDR ranges' },
    { id: 'rateLimit', label: 'Rate Limit (req/min)', dataType: 'number', constraints: [{ type: 'min', value: 1 }, { type: 'max', value: 10000 }] },
    { id: 'expiresAt', label: 'Expires At', dataType: 'datetime', description: 'Key expiration date, null for never' },
    { id: 'lastUsedAt', label: 'Last Used', dataType: 'datetime' },
    { id: 'usageCount', label: 'Usage Count', dataType: 'number', description: 'Total number of API calls made with this key' },
    {
      id: 'status',
      label: 'Status',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'active', label: 'Active' },
        { value: 'revoked', label: 'Revoked' },
        { value: 'expired', label: 'Expired' },
      ],
    },
    { id: 'revokedAt', label: 'Revoked At', dataType: 'datetime' },
    { id: 'revokedBy', label: 'Revoked By', dataType: 'string', description: 'User ID who revoked this key' },
    { id: 'revokeReason', label: 'Revoke Reason', dataType: 'string' },
    { id: 'createdAt', label: 'Created At', dataType: 'datetime', constraints: [{ type: 'required' }] },
  ],
}
