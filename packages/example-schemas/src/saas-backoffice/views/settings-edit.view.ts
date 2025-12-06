/**
 * Settings Edit View
 * Organization settings form with multiple conditional sections
 * Demonstrates complex visibility rules for integrations
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

export const settingsEditView = view(
  'settings-edit',
  'Organization Settings',
  '1.0.0'
)
  .entityRef('settings')
  .mode('edit')
  .description('Configure your organization preferences')
  .layout(layout.form(2))
  .header(
    header('Organization Settings', {
      subtitle: 'Manage preferences and integrations',
    })
  )
  .sections(
    section('general')
      .title('General Settings')
      .layout(layout.grid(3, '1rem'))
      .fields(
        viewField.select('timezone', 'timezone').label('Timezone').build(),
        viewField.select('dateFormat', 'dateFormat').label('Date Format').build(),
        viewField.select('language', 'language').label('Language').build()
      )
      .build(),

    section('security')
      .title('Security')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .toggle('requireMfa', 'requireMfa')
          .label('Require MFA')
          .helpText('Require all organization members to enable MFA')
          .build(),

        viewField
          .numberInput('sessionTimeout', 'sessionTimeout')
          .label('Session Timeout (minutes)')
          .helpText('Auto-logout after this many minutes of inactivity')
          .props({ min: 5, max: 10080 })
          .build(),

        viewField
          .textInput('allowedDomains', 'allowedDomains')
          .label('Allowed Email Domains')
          .placeholder('example.com, company.org')
          .helpText('Restrict signups to these email domains')
          .build(),

        viewField
          .textarea('ipWhitelist', 'ipWhitelist')
          .label('IP Whitelist')
          .placeholder('192.168.1.0/24, 10.0.0.1')
          .helpText('Only allow access from these IP addresses')
          .props({ rows: 2 })
          .build()
      )
      .build(),

    section('slack-toggle')
      .title('Slack Integration')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .toggle('slackIntegration', 'slackIntegration')
          .label('Enable Slack Integration')
          .helpText('Send notifications to Slack')
          .build()
      )
      .build(),

    section('slack-config')
      .title('Slack Configuration')
      .visible(fieldEquals('slackIntegration', true))
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('slackWebhookUrl', 'slackWebhookUrl')
          .label('Slack Webhook URL')
          .placeholder('https://hooks.slack.com/services/...')
          .build(),

        viewField
          .textInput('slackChannel', 'slackChannel')
          .label('Slack Channel')
          .placeholder('#general')
          .build()
      )
      .build(),

    section('webhook-toggle')
      .title('Webhooks')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .toggle('webhookEnabled', 'webhookEnabled')
          .label('Enable Webhooks')
          .helpText('Send events to an external URL')
          .build()
      )
      .build(),

    section('webhook-config')
      .title('Webhook Configuration')
      .visible(fieldEquals('webhookEnabled', true))
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('webhookUrl', 'webhookUrl')
          .label('Webhook URL')
          .placeholder('https://api.example.com/webhooks')
          .build(),

        viewField
          .textInput('webhookSecret', 'webhookSecret')
          .label('Webhook Secret')
          .placeholder('whsec_...')
          .helpText('Secret for verifying webhook signatures')
          .build()
      )
      .build(),

    section('email-toggle')
      .title('Email Notifications')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .toggle('emailNotifications', 'emailNotifications')
          .label('Enable Email Notifications')
          .helpText('Send email notifications to admins')
          .build()
      )
      .build(),

    section('email-config')
      .title('Notification Types')
      .visible(fieldEquals('emailNotifications', true))
      .layout(layout.grid(3, '1rem'))
      .fields(
        viewField
          .checkbox('notifyOnNewUser', 'notifyOnNewUser')
          .label('Notify on New User')
          .build(),

        viewField
          .checkbox('notifyOnBilling', 'notifyOnBilling')
          .label('Notify on Billing Events')
          .build(),

        viewField
          .checkbox('notifyOnSecurityAlert', 'notifyOnSecurityAlert')
          .label('Notify on Security Alerts')
          .build()
      )
      .build(),

    section('branding-toggle')
      .title('Custom Branding')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .toggle('customBranding', 'customBranding')
          .label('Enable Custom Branding')
          .helpText('Enable custom branding (Pro+ plans only)')
          .build()
      )
      .build(),

    section('branding-config')
      .title('Branding Settings')
      .visible(fieldEquals('customBranding', true))
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('primaryColor', 'primaryColor')
          .label('Primary Color')
          .placeholder('#3B82F6')
          .build(),

        viewField
          .textInput('logoUrl', 'logoUrl')
          .label('Custom Logo URL')
          .placeholder('https://example.com/logo.png')
          .build()
      )
      .build()
  )
  .footer(
    footer([
      viewAction.cancel('cancel', 'Discard Changes').build(),
      viewAction.submit('submit', 'Save Settings').build(),
    ])
  )
  .build()
