/**
 * API Key Create View
 * Form for creating a new API key with scopes and restrictions
 * IP restrictions shown only for admin scope (via section visibility)
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

export const apiKeyCreateView = view('api-key-create', 'Create API Key', '1.0.0')
  .entityRef('apiKey')
  .mode('create')
  .description('Generate a new API key')
  .layout(layout.form(2))
  .header(
    header('Create API Key', {
      subtitle: 'Generate credentials for API access',
    })
  )
  .sections(
    section('basic')
      .title('Key Information')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('name', 'name')
          .label('Key Name')
          .placeholder('My API Key')
          .helpText('Give your key a memorable name')
          .build(),

        viewField
          .select('environment', 'environment')
          .label('Environment')
          .helpText('Which environment will this key access?')
          .build()
      )
      .build(),

    section('permissions')
      .title('Permissions')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .radio('scopes', 'scopes')
          .label('Scopes')
          .helpText('What level of access should this key have?')
          .build()
      )
      .build(),

    section('ip-restrictions')
      .title('IP Restrictions')
      .description('Limit API access to specific IP addresses (Admin scope only)')
      .visible(fieldEquals('scopes', 'admin'))
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .textarea('ipRestrictions', 'ipRestrictions')
          .label('IP Restrictions')
          .placeholder('192.168.1.0/24, 10.0.0.1')
          .helpText('Comma-separated IP addresses or CIDR ranges')
          .props({ rows: 3 })
          .build()
      )
      .build(),

    section('rate-limit')
      .title('Rate Limiting')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .numberInput('rateLimit', 'rateLimit')
          .label('Rate Limit (req/min)')
          .helpText('Maximum requests per minute (1-10,000)')
          .props({ min: 1, max: 10000 })
          .build(),

        viewField
          .datePicker('expiresAt', 'expiresAt')
          .label('Expires At')
          .helpText('Leave empty for no expiration')
          .build()
      )
      .build()
  )
  .footer(
    footer([
      viewAction.cancel('cancel', 'Cancel').build(),
      viewAction.submit('submit', 'Generate Key').build(),
    ])
  )
  .build()
