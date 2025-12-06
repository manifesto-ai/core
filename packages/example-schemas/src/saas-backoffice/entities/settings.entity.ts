import type { EntitySchema } from '@manifesto-ai/schema'

/**
 * Settings Entity - Organization settings and preferences
 * Configures organization-wide preferences and integrations
 */
export const settingsEntity: EntitySchema = {
  _type: 'entity',
  id: 'settings',
  version: '1.0.0',
  name: 'Settings',
  description: 'Organization settings and configuration',
  fields: [
    { id: 'id', label: 'ID', dataType: 'string', constraints: [{ type: 'required' }] },
    { id: 'organizationId', label: 'Organization ID', dataType: 'string', constraints: [{ type: 'required' }] },
    // General Settings
    {
      id: 'timezone',
      label: 'Timezone',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'UTC', label: 'UTC' },
        { value: 'America/New_York', label: 'Eastern Time (US)' },
        { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
        { value: 'Europe/London', label: 'London' },
        { value: 'Europe/Paris', label: 'Paris' },
        { value: 'Asia/Tokyo', label: 'Tokyo' },
        { value: 'Asia/Seoul', label: 'Seoul' },
        { value: 'Asia/Singapore', label: 'Singapore' },
      ],
    },
    {
      id: 'dateFormat',
      label: 'Date Format',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
      ],
    },
    {
      id: 'language',
      label: 'Language',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'en', label: 'English' },
        { value: 'ko', label: '한국어' },
        { value: 'ja', label: '日本語' },
        { value: 'zh', label: '中文' },
        { value: 'es', label: 'Español' },
        { value: 'fr', label: 'Français' },
        { value: 'de', label: 'Deutsch' },
      ],
    },
    // Security Settings
    { id: 'requireMfa', label: 'Require MFA', dataType: 'boolean', description: 'Require all users to enable MFA', constraints: [{ type: 'required' }] },
    { id: 'allowedDomains', label: 'Allowed Email Domains', dataType: 'string', description: 'Comma-separated list of allowed email domains for signup' },
    { id: 'sessionTimeout', label: 'Session Timeout (minutes)', dataType: 'number', constraints: [{ type: 'required' }, { type: 'min', value: 5 }, { type: 'max', value: 10080 }] },
    { id: 'ipWhitelist', label: 'IP Whitelist', dataType: 'string', description: 'Comma-separated list of allowed IPs or CIDR ranges' },
    // Integration Settings
    { id: 'slackIntegration', label: 'Slack Integration', dataType: 'boolean', constraints: [{ type: 'required' }] },
    { id: 'slackWebhookUrl', label: 'Slack Webhook URL', dataType: 'string', description: 'Webhook URL for Slack notifications' },
    { id: 'slackChannel', label: 'Slack Channel', dataType: 'string' },
    { id: 'webhookEnabled', label: 'Webhooks Enabled', dataType: 'boolean', constraints: [{ type: 'required' }] },
    { id: 'webhookUrl', label: 'Webhook URL', dataType: 'string' },
    { id: 'webhookSecret', label: 'Webhook Secret', dataType: 'string', description: 'Secret for webhook signature verification' },
    // Notification Settings
    { id: 'emailNotifications', label: 'Email Notifications', dataType: 'boolean', constraints: [{ type: 'required' }] },
    { id: 'notifyOnNewUser', label: 'Notify on New User', dataType: 'boolean', constraints: [{ type: 'required' }] },
    { id: 'notifyOnBilling', label: 'Notify on Billing Events', dataType: 'boolean', constraints: [{ type: 'required' }] },
    { id: 'notifyOnSecurityAlert', label: 'Notify on Security Alerts', dataType: 'boolean', constraints: [{ type: 'required' }] },
    // Branding
    { id: 'customBranding', label: 'Custom Branding', dataType: 'boolean', description: 'Enable custom branding (Pro+ plans)', constraints: [{ type: 'required' }] },
    { id: 'primaryColor', label: 'Primary Color', dataType: 'string', description: 'Primary brand color (hex)' },
    { id: 'logoUrl', label: 'Custom Logo URL', dataType: 'string' },
    { id: 'updatedAt', label: 'Updated At', dataType: 'datetime', constraints: [{ type: 'required' }] },
    { id: 'updatedById', label: 'Updated By', dataType: 'string' },
  ],
}
