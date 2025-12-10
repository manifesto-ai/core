import React, { createContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { Subscription, Invoice, PaymentMethod, BillingPlan } from '../../types';
import { billingApi } from '../../api/billing';
import { useCurrentOrganization } from '../auth/useAuth';

interface BillingState {
  subscription: Subscription | null;
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
  isLoading: boolean;
  error: string | null;
  upgradeModalOpen: boolean;
  selectedPlan: BillingPlan | null;
}

type BillingAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { subscription: Subscription; invoices: Invoice[]; paymentMethods: PaymentMethod[] } }
  | { type: 'FETCH_FAILURE'; payload: string }
  | { type: 'UPDATE_SUBSCRIPTION'; payload: Subscription }
  | { type: 'ADD_PAYMENT_METHOD'; payload: PaymentMethod }
  | { type: 'REMOVE_PAYMENT_METHOD'; payload: string }
  | { type: 'SET_DEFAULT_PAYMENT'; payload: string }
  | { type: 'OPEN_UPGRADE_MODAL'; payload: BillingPlan }
  | { type: 'CLOSE_UPGRADE_MODAL' }
  | { type: 'ADD_INVOICE'; payload: Invoice };

const initialState: BillingState = {
  subscription: null,
  invoices: [],
  paymentMethods: [],
  isLoading: true,
  error: null,
  upgradeModalOpen: false,
  selectedPlan: null,
};

function billingReducer(state: BillingState, action: BillingAction): BillingState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        subscription: action.payload.subscription,
        invoices: action.payload.invoices,
        paymentMethods: action.payload.paymentMethods,
        isLoading: false,
      };
    case 'FETCH_FAILURE':
      return { ...state, isLoading: false, error: action.payload };
    case 'UPDATE_SUBSCRIPTION':
      return { ...state, subscription: action.payload };
    case 'ADD_PAYMENT_METHOD':
      return { ...state, paymentMethods: [...state.paymentMethods, action.payload] };
    case 'REMOVE_PAYMENT_METHOD':
      return {
        ...state,
        paymentMethods: state.paymentMethods.filter(pm => pm.id !== action.payload),
      };
    case 'SET_DEFAULT_PAYMENT':
      return {
        ...state,
        paymentMethods: state.paymentMethods.map(pm => ({
          ...pm,
          isDefault: pm.id === action.payload,
        })),
      };
    case 'OPEN_UPGRADE_MODAL':
      return { ...state, upgradeModalOpen: true, selectedPlan: action.payload };
    case 'CLOSE_UPGRADE_MODAL':
      return { ...state, upgradeModalOpen: false, selectedPlan: null };
    case 'ADD_INVOICE':
      return { ...state, invoices: [action.payload, ...state.invoices] };
    default:
      return state;
  }
}

interface BillingContextValue extends BillingState {
  fetchBillingData: () => Promise<void>;
  upgradePlan: (plan: BillingPlan) => Promise<void>;
  downgradePlan: (plan: BillingPlan) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  resumeSubscription: () => Promise<void>;
  addPaymentMethod: (token: string) => Promise<void>;
  removePaymentMethod: (id: string) => Promise<void>;
  setDefaultPaymentMethod: (id: string) => Promise<void>;
  updateSeats: (seats: number) => Promise<void>;
  openUpgradeModal: (plan: BillingPlan) => void;
  closeUpgradeModal: () => void;
  downloadInvoice: (invoiceId: string) => Promise<void>;
}

export const BillingContext = createContext<BillingContextValue | null>(null);

interface BillingProviderProps {
  children: ReactNode;
}

export function BillingProvider({ children }: BillingProviderProps) {
  const [state, dispatch] = useReducer(billingReducer, initialState);
  const { organization } = useCurrentOrganization();

  const fetchBillingData = useCallback(async () => {
    if (!organization) return;
    dispatch({ type: 'FETCH_START' });
    try {
      const [subscription, invoices, paymentMethods] = await Promise.all([
        billingApi.getSubscription(organization.id),
        billingApi.getInvoices(organization.id),
        billingApi.getPaymentMethods(organization.id),
      ]);
      dispatch({ type: 'FETCH_SUCCESS', payload: { subscription, invoices, paymentMethods } });
    } catch (err) {
      dispatch({ type: 'FETCH_FAILURE', payload: (err as Error).message });
    }
  }, [organization]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const upgradePlan = useCallback(async (plan: BillingPlan) => {
    if (!organization) return;
    const subscription = await billingApi.upgradePlan(organization.id, plan);
    dispatch({ type: 'UPDATE_SUBSCRIPTION', payload: subscription });
    dispatch({ type: 'CLOSE_UPGRADE_MODAL' });
  }, [organization]);

  const downgradePlan = useCallback(async (plan: BillingPlan) => {
    if (!organization) return;
    const subscription = await billingApi.downgradePlan(organization.id, plan);
    dispatch({ type: 'UPDATE_SUBSCRIPTION', payload: subscription });
  }, [organization]);

  const cancelSubscription = useCallback(async () => {
    if (!organization || !state.subscription) return;
    const subscription = await billingApi.cancelSubscription(organization.id);
    dispatch({ type: 'UPDATE_SUBSCRIPTION', payload: subscription });
  }, [organization, state.subscription]);

  const resumeSubscription = useCallback(async () => {
    if (!organization || !state.subscription) return;
    const subscription = await billingApi.resumeSubscription(organization.id);
    dispatch({ type: 'UPDATE_SUBSCRIPTION', payload: subscription });
  }, [organization, state.subscription]);

  const addPaymentMethod = useCallback(async (token: string) => {
    if (!organization) return;
    const paymentMethod = await billingApi.addPaymentMethod(organization.id, token);
    dispatch({ type: 'ADD_PAYMENT_METHOD', payload: paymentMethod });
  }, [organization]);

  const removePaymentMethod = useCallback(async (id: string) => {
    if (!organization) return;
    await billingApi.removePaymentMethod(organization.id, id);
    dispatch({ type: 'REMOVE_PAYMENT_METHOD', payload: id });
  }, [organization]);

  const setDefaultPaymentMethod = useCallback(async (id: string) => {
    if (!organization) return;
    await billingApi.setDefaultPaymentMethod(organization.id, id);
    dispatch({ type: 'SET_DEFAULT_PAYMENT', payload: id });
  }, [organization]);

  const updateSeats = useCallback(async (seats: number) => {
    if (!organization) return;
    const subscription = await billingApi.updateSeats(organization.id, seats);
    dispatch({ type: 'UPDATE_SUBSCRIPTION', payload: subscription });
  }, [organization]);

  const openUpgradeModal = useCallback((plan: BillingPlan) => {
    dispatch({ type: 'OPEN_UPGRADE_MODAL', payload: plan });
  }, []);

  const closeUpgradeModal = useCallback(() => {
    dispatch({ type: 'CLOSE_UPGRADE_MODAL' });
  }, []);

  const downloadInvoice = useCallback(async (invoiceId: string) => {
    if (!organization) return;
    await billingApi.downloadInvoice(organization.id, invoiceId);
  }, [organization]);

  return (
    <BillingContext.Provider
      value={{
        ...state,
        fetchBillingData,
        upgradePlan,
        downgradePlan,
        cancelSubscription,
        resumeSubscription,
        addPaymentMethod,
        removePaymentMethod,
        setDefaultPaymentMethod,
        updateSeats,
        openUpgradeModal,
        closeUpgradeModal,
        downloadInvoice,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
}
