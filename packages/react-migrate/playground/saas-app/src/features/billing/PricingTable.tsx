import React from 'react';
import { useBilling, useSubscription } from './useBilling';
import { usePermissions } from '../auth/useAuth';
import { BillingPlan } from '../../types';

interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

interface PlanInfo {
  name: string;
  price: number;
  period: 'month' | 'year';
  description: string;
  features: PlanFeature[];
  popular?: boolean;
}

const plans: Record<BillingPlan, PlanInfo> = {
  free: {
    name: 'Free',
    price: 0,
    period: 'month',
    description: 'For individuals and small teams getting started',
    features: [
      { name: 'Up to 3 team members', included: true },
      { name: '3 projects', included: true },
      { name: '1GB storage', included: true },
      { name: 'Basic analytics', included: true },
      { name: 'Community support', included: true },
      { name: 'SSO', included: false },
      { name: 'Advanced permissions', included: false },
    ],
  },
  starter: {
    name: 'Starter',
    price: 12,
    period: 'month',
    description: 'For growing teams who need more power',
    features: [
      { name: 'Up to 10 team members', included: true },
      { name: '10 projects', included: true },
      { name: '10GB storage', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Email support', included: true },
      { name: 'SSO', included: false },
      { name: 'Advanced permissions', included: true },
    ],
  },
  professional: {
    name: 'Professional',
    price: 29,
    period: 'month',
    description: 'For teams who need advanced features',
    popular: true,
    features: [
      { name: 'Up to 50 team members', included: true },
      { name: '50 projects', included: true },
      { name: '100GB storage', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Priority support', included: true },
      { name: 'SSO', included: true },
      { name: 'Advanced permissions', included: true },
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    period: 'month',
    description: 'For organizations with advanced needs',
    features: [
      { name: 'Unlimited team members', included: true },
      { name: 'Unlimited projects', included: true },
      { name: 'Unlimited storage', included: true },
      { name: 'Custom analytics', included: true },
      { name: 'Dedicated support', included: true },
      { name: 'SSO', included: true },
      { name: 'Advanced permissions', included: true },
    ],
  },
};

export function PricingTable() {
  const { subscription } = useSubscription();
  const { openUpgradeModal, isLoading } = useBilling();
  const { canManageBilling } = usePermissions();

  const currentPlan = subscription?.plan || 'free';

  const handleSelectPlan = (plan: BillingPlan) => {
    if (!canManageBilling()) return;
    if (plan === currentPlan) return;
    openUpgradeModal(plan);
  };

  const getPlanOrder = (plan: BillingPlan): number => {
    const order: Record<BillingPlan, number> = {
      free: 0,
      starter: 1,
      professional: 2,
      enterprise: 3,
    };
    return order[plan];
  };

  const isUpgrade = (plan: BillingPlan) => getPlanOrder(plan) > getPlanOrder(currentPlan);
  const isDowngrade = (plan: BillingPlan) => getPlanOrder(plan) < getPlanOrder(currentPlan);

  return (
    <div className="pricing-table">
      <div className="pricing-header">
        <h2>Choose your plan</h2>
        <p>Select the perfect plan for your team's needs</p>
      </div>

      <div className="plans-grid">
        {(Object.entries(plans) as [BillingPlan, PlanInfo][]).map(([planKey, plan]) => (
          <div
            key={planKey}
            className={`plan-card ${plan.popular ? 'popular' : ''} ${planKey === currentPlan ? 'current' : ''}`}
          >
            {plan.popular && <span className="popular-badge">Most Popular</span>}
            {planKey === currentPlan && <span className="current-badge">Current Plan</span>}

            <h3>{plan.name}</h3>
            <div className="price">
              <span className="amount">${plan.price}</span>
              <span className="period">/{plan.period}</span>
            </div>
            <p className="description">{plan.description}</p>

            <ul className="features">
              {plan.features.map((feature, idx) => (
                <li key={idx} className={feature.included ? 'included' : 'not-included'}>
                  <span className="icon">{feature.included ? '✓' : '×'}</span>
                  {feature.name}
                  {feature.limit && <span className="limit">{feature.limit}</span>}
                </li>
              ))}
            </ul>

            <button
              className={`select-plan ${isUpgrade(planKey) ? 'upgrade' : ''} ${isDowngrade(planKey) ? 'downgrade' : ''}`}
              onClick={() => handleSelectPlan(planKey)}
              disabled={isLoading || planKey === currentPlan || !canManageBilling()}
            >
              {planKey === currentPlan
                ? 'Current Plan'
                : isUpgrade(planKey)
                ? 'Upgrade'
                : 'Downgrade'}
            </button>
          </div>
        ))}
      </div>

      {!canManageBilling() && (
        <p className="billing-notice">
          Only organization owners can manage billing. Contact your administrator.
        </p>
      )}
    </div>
  );
}
