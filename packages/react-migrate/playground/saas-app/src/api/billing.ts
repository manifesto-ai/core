import { Subscription, Invoice, PaymentMethod, BillingPlan } from '../types';

export const billingApi = {
  async getSubscription(orgId: string): Promise<Subscription> {
    const response = await fetch(`/api/organizations/${orgId}/subscription`);
    if (!response.ok) throw new Error('Failed to fetch subscription');
    return response.json();
  },

  async getInvoices(orgId: string): Promise<Invoice[]> {
    const response = await fetch(`/api/organizations/${orgId}/invoices`);
    if (!response.ok) throw new Error('Failed to fetch invoices');
    return response.json();
  },

  async getPaymentMethods(orgId: string): Promise<PaymentMethod[]> {
    const response = await fetch(`/api/organizations/${orgId}/payment-methods`);
    if (!response.ok) throw new Error('Failed to fetch payment methods');
    return response.json();
  },

  async upgradePlan(orgId: string, plan: BillingPlan): Promise<Subscription> {
    const response = await fetch(`/api/organizations/${orgId}/subscription/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    if (!response.ok) throw new Error('Failed to upgrade plan');
    return response.json();
  },

  async downgradePlan(orgId: string, plan: BillingPlan): Promise<Subscription> {
    const response = await fetch(`/api/organizations/${orgId}/subscription/downgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    if (!response.ok) throw new Error('Failed to downgrade plan');
    return response.json();
  },

  async cancelSubscription(orgId: string): Promise<Subscription> {
    const response = await fetch(`/api/organizations/${orgId}/subscription/cancel`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to cancel subscription');
    return response.json();
  },

  async resumeSubscription(orgId: string): Promise<Subscription> {
    const response = await fetch(`/api/organizations/${orgId}/subscription/resume`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to resume subscription');
    return response.json();
  },

  async addPaymentMethod(orgId: string, token: string): Promise<PaymentMethod> {
    const response = await fetch(`/api/organizations/${orgId}/payment-methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) throw new Error('Failed to add payment method');
    return response.json();
  },

  async removePaymentMethod(orgId: string, paymentMethodId: string): Promise<void> {
    const response = await fetch(`/api/organizations/${orgId}/payment-methods/${paymentMethodId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to remove payment method');
  },

  async setDefaultPaymentMethod(orgId: string, paymentMethodId: string): Promise<void> {
    const response = await fetch(`/api/organizations/${orgId}/payment-methods/${paymentMethodId}/default`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to set default payment method');
  },

  async updateSeats(orgId: string, seats: number): Promise<Subscription> {
    const response = await fetch(`/api/organizations/${orgId}/subscription/seats`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seats }),
    });
    if (!response.ok) throw new Error('Failed to update seats');
    return response.json();
  },

  async downloadInvoice(orgId: string, invoiceId: string): Promise<void> {
    const response = await fetch(`/api/organizations/${orgId}/invoices/${invoiceId}/download`);
    if (!response.ok) throw new Error('Failed to download invoice');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceId}.pdf`;
    a.click();
  },
};
