import type { EntitySchema } from '@manifesto-ai/schema'

/**
 * User Entity - Platform user with role-based access
 * Supports MFA, invitation flow, and multi-organization membership
 */
export const userEntity: EntitySchema = {
  _type: 'entity',
  id: 'user',
  version: '1.0.0',
  name: 'User',
  description: 'Platform user with authentication and authorization',
  fields: [
    {
      id: 'id',
      label: 'ID',
      dataType: 'string',
      constraints: [{ type: 'required' }],
    },
    {
      id: 'email',
      label: 'Email',
      dataType: 'string',
      constraints: [
        { type: 'required' },
        { type: 'pattern', value: '^[^@]+@[^@]+\\.[^@]+$' },
      ],
    },
    {
      id: 'firstName',
      label: 'First Name',
      dataType: 'string',
      constraints: [
        { type: 'required' },
        { type: 'min', value: 1 },
        { type: 'max', value: 50 },
      ],
    },
    {
      id: 'lastName',
      label: 'Last Name',
      dataType: 'string',
      constraints: [
        { type: 'required' },
        { type: 'min', value: 1 },
        { type: 'max', value: 50 },
      ],
    },
    {
      id: 'avatar',
      label: 'Avatar URL',
      dataType: 'string',
    },
    {
      id: 'role',
      label: 'Role',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'owner', label: 'Owner' },
        { value: 'admin', label: 'Admin' },
        { value: 'member', label: 'Member' },
        { value: 'viewer', label: 'Viewer' },
      ],
    },
    {
      id: 'status',
      label: 'Status',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'active', label: 'Active' },
        { value: 'invited', label: 'Invited' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'deactivated', label: 'Deactivated' },
      ],
    },
    {
      id: 'mfaEnabled',
      label: 'MFA Enabled',
      dataType: 'boolean',
      constraints: [{ type: 'required' }],
    },
    {
      id: 'mfaMethod',
      label: 'MFA Method',
      dataType: 'enum',
      description: 'Required when MFA is enabled',
      enumValues: [
        { value: 'totp', label: 'Authenticator App (TOTP)' },
        { value: 'sms', label: 'SMS' },
        { value: 'email', label: 'Email' },
      ],
    },
    {
      id: 'phone',
      label: 'Phone Number',
      dataType: 'string',
      description: 'Required for SMS MFA',
    },
    {
      id: 'invitedBy',
      label: 'Invited By',
      dataType: 'string',
      description: 'User ID of the inviter',
    },
    {
      id: 'invitedAt',
      label: 'Invited At',
      dataType: 'datetime',
    },
    {
      id: 'joinedAt',
      label: 'Joined At',
      dataType: 'datetime',
    },
    {
      id: 'lastLoginAt',
      label: 'Last Login',
      dataType: 'datetime',
    },
    {
      id: 'organizationId',
      label: 'Organization ID',
      dataType: 'string',
      constraints: [{ type: 'required' }],
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
