/**
 * Organization Create View
 * Form for creating a new organization with trial setup
 */

import {
  view,
  section,
  layout,
  header,
  footer,
  viewAction,
  viewField,
} from '@manifesto-ai/schema'

export const organizationCreateView = view(
  'organization-create',
  'Create Organization',
  '1.0.0'
)
  .entityRef('organization')
  .mode('create')
  .description('Create a new organization or workspace')
  .layout(layout.form(2))
  .header(
    header('Create Organization', {
      subtitle: 'Set up your new workspace',
    })
  )
  .sections(
    section('basic')
      .title('Basic Information')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('name', 'name')
          .label('Organization Name')
          .placeholder('Acme Inc.')
          .build(),

        viewField
          .textInput('slug', 'slug')
          .label('URL Slug')
          .placeholder('my-company')
          .helpText('This will be your organization URL: app.example.com/{slug}')
          .build(),

        viewField
          .select('industry', 'industry')
          .label('Industry')
          .build(),

        viewField
          .select('size', 'size')
          .label('Company Size')
          .build()
      )
      .build(),

    section('contact')
      .title('Contact Information')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('website', 'website')
          .label('Website')
          .placeholder('https://example.com')
          .build(),

        viewField
          .textInput('billingEmail', 'billingEmail')
          .label('Billing Email')
          .placeholder('billing@example.com')
          .build()
      )
      .build(),

    section('branding')
      .title('Branding')
      .description('Customize your organization appearance')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .textInput('logo', 'logo')
          .label('Logo URL')
          .placeholder('https://example.com/logo.png')
          .build()
      )
      .build()
  )
  .footer(
    footer([
      viewAction.cancel('cancel', 'Cancel').build(),
      viewAction.submit('submit', 'Create Organization').build(),
    ])
  )
  .build()
