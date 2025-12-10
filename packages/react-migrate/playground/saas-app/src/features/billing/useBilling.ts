import { useContext, useMemo } from 'react';
import { BillingContext } from './BillingContext';
import { BillingPlan } from '../../types';

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
}

export function useSubscription() {
  const { subscription, isLoading } = useBilling();
  return { subscription, isLoading };
}

export function usePlanLimits() {
  const { subscription } = useBilling();

  const limits = useMemo(() => {
    const planLimits: Record<BillingPlan, { seats: number; storage: number; apiCalls: number; projects: number }> = {
      free: { seats: 3, storage: 1024, apiCalls: 1000, projects: 3 },
      starter: { seats: 10, storage: 10240, apiCalls: 10000, projects: 10 },
      professional: { seats: 50, storage: 102400, apiCalls: 100000, projects: 50 },
      enterprise: { seats: -1, storage: -1, apiCalls: -1, projects: -1 }, // unlimited
    };

    return subscription ? planLimits[subscription.plan] : planLimits.free;
  }, [subscription]);

  const usage = useMemo(() => {
    if (!subscription) {
      return { seats: 0, storage: 0, apiCalls: 0, projects: 0 };
    }
    return {
      seats: subscription.usedSeats,
      storage: 0, // Would come from separate API
      apiCalls: 0,
      projects: 0,
    };
  }, [subscription]);

  const isAtLimit = (resource: 'seats' | 'storage' | 'apiCalls' | 'projects') => {
    if (limits[resource] === -1) return false; // unlimited
    return usage[resource] >= limits[resource];
  };

  const percentUsed = (resource: 'seats' | 'storage' | 'apiCalls' | 'projects') => {
    if (limits[resource] === -1) return 0;
    return (usage[resource] / limits[resource]) * 100;
  };

  return { limits, usage, isAtLimit, percentUsed };
}

export function useInvoices() {
  const { invoices, isLoading, downloadInvoice } = useBilling();
  return { invoices, isLoading, downloadInvoice };
}

export function usePaymentMethods() {
  const {
    paymentMethods,
    isLoading,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
  } = useBilling();

  const defaultMethod = paymentMethods.find(pm => pm.isDefault);

  return {
    paymentMethods,
    defaultMethod,
    isLoading,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
  };
}
