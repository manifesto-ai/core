import type { EntitySchema } from '@manifesto-ai/schema'

/**
 * AuditLog Entity - Activity logs and audit trail
 * Tracks all significant actions for security and compliance
 */
export const auditLogEntity: EntitySchema = {
  _type: 'entity',
  id: 'auditLog',
  version: '1.0.0',
  name: 'Audit Log',
  description: 'Activity logs and audit trail for compliance',
  fields: [
    { id: 'id', label: 'ID', dataType: 'string', constraints: [{ type: 'required' }] },
    { id: 'organizationId', label: 'Organization ID', dataType: 'string', constraints: [{ type: 'required' }] },
    { id: 'actorId', label: 'Actor ID', dataType: 'string', description: 'User or API key that performed the action' },
    {
      id: 'actorType',
      label: 'Actor Type',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'user', label: 'User' },
        { value: 'api_key', label: 'API Key' },
        { value: 'system', label: 'System' },
        { value: 'webhook', label: 'Webhook' },
      ],
    },
    { id: 'actorEmail', label: 'Actor Email', dataType: 'string', description: 'Email of the user (for user actors)' },
    {
      id: 'action',
      label: 'Action',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'create', label: 'Create' },
        { value: 'read', label: 'Read' },
        { value: 'update', label: 'Update' },
        { value: 'delete', label: 'Delete' },
        { value: 'login', label: 'Login' },
        { value: 'logout', label: 'Logout' },
        { value: 'invite', label: 'Invite' },
        { value: 'revoke', label: 'Revoke' },
        { value: 'export', label: 'Export' },
        { value: 'import', label: 'Import' },
      ],
    },
    {
      id: 'resourceType',
      label: 'Resource Type',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'organization', label: 'Organization' },
        { value: 'user', label: 'User' },
        { value: 'subscription', label: 'Subscription' },
        { value: 'api_key', label: 'API Key' },
        { value: 'settings', label: 'Settings' },
        { value: 'feature', label: 'Feature' },
        { value: 'data', label: 'Data' },
      ],
    },
    { id: 'resourceId', label: 'Resource ID', dataType: 'string', description: 'ID of the affected resource' },
    { id: 'resourceName', label: 'Resource Name', dataType: 'string', description: 'Human-readable name of the resource' },
    { id: 'description', label: 'Description', dataType: 'string', description: 'Human-readable description of the action', constraints: [{ type: 'required' }] },
    { id: 'metadata', label: 'Metadata', dataType: 'string', description: 'JSON string with additional context' },
    { id: 'changes', label: 'Changes', dataType: 'string', description: 'JSON diff of before/after values' },
    { id: 'ipAddress', label: 'IP Address', dataType: 'string' },
    { id: 'userAgent', label: 'User Agent', dataType: 'string' },
    { id: 'location', label: 'Location', dataType: 'string', description: 'Geo-location based on IP' },
    {
      id: 'status',
      label: 'Status',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'success', label: 'Success' },
        { value: 'failure', label: 'Failure' },
        { value: 'warning', label: 'Warning' },
      ],
    },
    { id: 'errorMessage', label: 'Error Message', dataType: 'string', description: 'Error details if status is failure' },
    {
      id: 'severity',
      label: 'Severity',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
    },
    { id: 'createdAt', label: 'Created At', dataType: 'datetime', constraints: [{ type: 'required' }] },
  ],
}
