/**
 * Subscription Wizard View
 * Multi-step subscription form with conditional sections
 * Shows billing cycle, coupon (annual only), payment method variations
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
  fieldIn,
  neq,
  $,
} from '@manifesto-ai/schema'

// Helper: fieldNotEquals
const fieldNotEquals = (field: string, value: string) => neq($.state(field), value)

export const subscriptionWizardView = view(
  'subscription-wizard',
  'Subscription Setup',
  '1.0.0'
)
  .entityRef('subscription')
  .mode('create')
  .description('Configure your subscription plan')
  .layout(layout.form(2))
  .header(
    header('Set Up Your Subscription', {
      subtitle: 'Choose a plan that works for your team',
    })
  )
  .sections(
    section('plan')
      .title('Plan Selection')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .radio('planId', 'planId')
          .label('Choose Plan')
          .props({
            options: [
              { value: 'free', label: 'Free - $0/month' },
              { value: 'pro', label: 'Pro - $29/seat/month' },
              { value: 'enterprise', label: 'Enterprise - Custom pricing' },
            ],
          })
          .build()
      )
      .build(),

    section('billing-cycle')
      .title('Billing Cycle')
      .visible(fieldIn('planId', ['pro', 'enterprise']))
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .radio('billingCycle', 'billingCycle')
          .label('Billing Cycle')
          .build()
      )
      .build(),

    section('seats')
      .title('Team Size')
      .visible(fieldNotEquals('planId', 'free'))
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .numberInput('seats', 'seats')
          .label('Number of Seats')
          .helpText('Number of team members who will use the platform')
          .props({ min: 1, max: 1000 })
          .build()
      )
      .build(),

    section('discount')
      .title('Discount')
      .visible(fieldEquals('billingCycle', 'annual'))
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .textInput('couponCode', 'couponCode')
          .label('Coupon Code')
          .placeholder('Enter coupon code')
          .helpText('Save 20% with annual billing! Have a coupon? Enter it here.')
          .build()
      )
      .build(),

    section('currency')
      .title('Currency')
      .visible(fieldNotEquals('planId', 'free'))
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .select('currency', 'currency')
          .label('Currency')
          .build()
      )
      .build(),

    section('payment-method')
      .title('Payment Method')
      .visible(fieldNotEquals('planId', 'free'))
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .radio('paymentMethod', 'paymentMethod')
          .label('Payment Method')
          .build()
      )
      .build(),

    section('card-details')
      .title('Card Details')
      .visible(fieldEquals('paymentMethod', 'card'))
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .textInput('cardLast4', 'cardLast4')
          .label('Card Last 4 Digits')
          .placeholder('4242')
          .helpText('Last 4 digits of your credit card')
          .build()
      )
      .build()
  )
  .footer(
    footer([
      viewAction.cancel('cancel', 'Cancel').build(),
      viewAction.submit('submit', 'Start Subscription').build(),
    ])
  )
  .build()
