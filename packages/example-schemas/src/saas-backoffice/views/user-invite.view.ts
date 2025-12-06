/**
 * User Invite View
 * Form for inviting a new user with MFA configuration
 * Demonstrates visibility rules for conditional fields using sections
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

export const userInviteView = view('user-invite', 'Invite User', '1.0.0')
  .entityRef('user')
  .mode('create')
  .description('Invite a new team member')
  .layout(layout.form(2))
  .header(
    header('Invite Team Member', {
      subtitle: 'Send an invitation to join your organization',
    })
  )
  .sections(
    section('basic')
      .title('User Information')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('email', 'email')
          .label('Email')
          .placeholder('user@example.com')
          .build(),

        viewField
          .textInput('firstName', 'firstName')
          .label('First Name')
          .build(),

        viewField
          .textInput('lastName', 'lastName')
          .label('Last Name')
          .build()
      )
      .build(),

    section('permissions')
      .title('Permissions')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .select('role', 'role')
          .label('Role')
          .helpText('What level of access should this user have?')
          .build()
      )
      .build(),

    section('security-base')
      .title('Security Settings')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .toggle('mfaEnabled', 'mfaEnabled')
          .label('Require MFA')
          .helpText('Require multi-factor authentication for this user')
          .build()
      )
      .build(),

    section('mfa-method')
      .title('MFA Configuration')
      .visible(fieldEquals('mfaEnabled', true))
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .select('mfaMethod', 'mfaMethod')
          .label('MFA Method')
          .build()
      )
      .build(),

    section('phone-for-sms')
      .title('Phone for SMS MFA')
      .visible([
        'AND',
        fieldEquals('mfaEnabled', true),
        fieldEquals('mfaMethod', 'sms'),
      ])
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .textInput('phone', 'phone')
          .label('Phone Number')
          .placeholder('+1 (555) 123-4567')
          .build()
      )
      .build()
  )
  .footer(
    footer([
      viewAction.cancel('cancel', 'Cancel').build(),
      viewAction.submit('submit', 'Send Invitation').build(),
    ])
  )
  .build()
