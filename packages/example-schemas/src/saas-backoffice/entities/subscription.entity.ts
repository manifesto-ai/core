import type { EntitySchema } from '@manifesto-ai/schema'

/**
 * Subscription Entity - Billing and subscription management
 * Handles recurring payments, upgrades/downgrades, and cancellations
 */
export const subscriptionEntity: EntitySchema = {
  _type: 'entity',
  id: 'subscription',
  version: '1.0.0',
  name: 'Subscription',
  description: 'Subscription and billing management',
  fields: [
    { id: 'id', label: 'ID', dataType: 'string', constraints: [{ type: 'required' }] },
    { id: 'organizationId', label: 'Organization ID', dataType: 'string', constraints: [{ type: 'required' }] },
    { id: 'planId', label: 'Plan ID', dataType: 'string', constraints: [{ type: 'required' }] },
    {
      id: 'status',
      label: 'Status',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'active', label: 'Active' },
        { value: 'trialing', label: 'Trialing' },
        { value: 'past_due', label: 'Past Due' },
        { value: 'canceled', label: 'Canceled' },
        { value: 'paused', label: 'Paused' },
      ],
    },
    {
      id: 'billingCycle',
      label: 'Billing Cycle',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'monthly', label: 'Monthly' },
        { value: 'annual', label: 'Annual' },
      ],
    },
    { id: 'seats', label: 'Number of Seats', dataType: 'number', constraints: [{ type: 'required' }, { type: 'min', value: 1 }, { type: 'max', value: 1000 }] },
    { id: 'pricePerSeat', label: 'Price Per Seat', dataType: 'number', constraints: [{ type: 'required' }, { type: 'min', value: 0 }] },
    { id: 'totalAmount', label: 'Total Amount', dataType: 'number', constraints: [{ type: 'required' }] },
    {
      id: 'currency',
      label: 'Currency',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
        { value: 'GBP', label: 'GBP' },
        { value: 'JPY', label: 'JPY' },
        { value: 'KRW', label: 'KRW' },
      ],
    },
    { id: 'couponCode', label: 'Coupon Code', dataType: 'string', description: 'Applied discount coupon (annual billing only)' },
    { id: 'discountPercent', label: 'Discount Percent', dataType: 'number', constraints: [{ type: 'min', value: 0 }, { type: 'max', value: 100 }] },
    {
      id: 'paymentMethod',
      label: 'Payment Method',
      dataType: 'enum',
      constraints: [{ type: 'required' }],
      enumValues: [
        { value: 'card', label: 'Credit Card' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
        { value: 'invoice', label: 'Invoice' },
      ],
    },
    { id: 'cardLast4', label: 'Card Last 4 Digits', dataType: 'string' },
    { id: 'currentPeriodStart', label: 'Current Period Start', dataType: 'date', constraints: [{ type: 'required' }] },
    { id: 'currentPeriodEnd', label: 'Current Period End', dataType: 'date', constraints: [{ type: 'required' }] },
    { id: 'cancelAtPeriodEnd', label: 'Cancel at Period End', dataType: 'boolean', constraints: [{ type: 'required' }] },
    { id: 'canceledAt', label: 'Canceled At', dataType: 'datetime', description: 'When the subscription was canceled' },
    {
      id: 'cancelReason',
      label: 'Cancellation Reason',
      dataType: 'enum',
      enumValues: [
        { value: 'too_expensive', label: 'Too expensive' },
        { value: 'missing_features', label: 'Missing features' },
        { value: 'switched_competitor', label: 'Switched to competitor' },
        { value: 'not_using', label: 'Not using enough' },
        { value: 'other', label: 'Other' },
      ],
    },
    { id: 'createdAt', label: 'Created At', dataType: 'datetime', constraints: [{ type: 'required' }] },
    { id: 'updatedAt', label: 'Updated At', dataType: 'datetime', constraints: [{ type: 'required' }] },
  ],
}
