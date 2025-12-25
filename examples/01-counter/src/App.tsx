/**
 * Counter App Component
 *
 * Demonstrates using Manifesto hooks:
 * - useValue: Subscribe to path values
 * - useSetValue: Update values
 * - useDerived: Access computed values
 */

import { useValue, useSetValue, useDerived } from '@manifesto-ai/bridge-react';
import type { SemanticPath } from '@manifesto-ai/core';

// ============================================================================
// Counter Display
// ============================================================================

function CounterDisplay() {
  const { value: count } = useValue<number>('data.count' as SemanticPath);
  const { value: doubled } = useDerived<number>('derived.doubled' as SemanticPath);
  const { value: isPositive } = useDerived<boolean>('derived.isPositive' as SemanticPath);
  const { value: isNegative } = useDerived<boolean>('derived.isNegative' as SemanticPath);

  return (
    <div style={styles.display}>
      <div style={styles.countWrapper}>
        <span style={styles.label}>Count</span>
        <span
          style={{
            ...styles.count,
            color: isPositive ? '#10b981' : isNegative ? '#ef4444' : '#6b7280',
          }}
        >
          {count}
        </span>
      </div>
      <div style={styles.derivedWrapper}>
        <span style={styles.derivedLabel}>Doubled:</span>
        <span style={styles.derivedValue}>{doubled}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Counter Controls
// ============================================================================

function CounterControls() {
  const { setValue } = useSetValue();
  const { value: count } = useValue<number>('data.count' as SemanticPath);
  const { value: step } = useValue<number>('state.step' as SemanticPath);

  const handleIncrement = () => {
    setValue('data.count' as SemanticPath, count + step);
  };

  const handleDecrement = () => {
    setValue('data.count' as SemanticPath, count - step);
  };

  const handleReset = () => {
    setValue('data.count' as SemanticPath, 0);
  };

  return (
    <div style={styles.controls}>
      <button onClick={handleDecrement} style={styles.button}>
        - {step}
      </button>
      <button onClick={handleReset} style={styles.resetButton}>
        Reset
      </button>
      <button onClick={handleIncrement} style={styles.button}>
        + {step}
      </button>
    </div>
  );
}

// ============================================================================
// Step Selector
// ============================================================================

function StepSelector() {
  const { value: step } = useValue<number>('state.step' as SemanticPath);
  const { setValue } = useSetValue();

  const handleStepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStep = parseInt(e.target.value, 10) || 1;
    setValue('state.step' as SemanticPath, newStep);
  };

  return (
    <div style={styles.stepSelector}>
      <label style={styles.stepLabel}>
        Step Size:
        <input
          type="number"
          value={step}
          onChange={handleStepChange}
          min={1}
          max={100}
          style={styles.stepInput}
        />
      </label>
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================

export default function App() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Manifesto Counter</h1>
      <p style={styles.subtitle}>A simple counter using @manifesto-ai/core</p>
      <CounterDisplay />
      <CounterControls />
      <StepSelector />
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    textAlign: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px',
  },
  display: {
    marginBottom: '24px',
  },
  countWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  label: {
    fontSize: '14px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  count: {
    fontSize: '72px',
    fontWeight: 'bold',
    lineHeight: 1,
    transition: 'color 0.2s',
  },
  derivedWrapper: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
  },
  derivedLabel: {
    fontSize: '14px',
    color: '#6b7280',
  },
  derivedValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  controls: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  resetButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
    backgroundColor: '#e5e7eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  stepSelector: {
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb',
  },
  stepLabel: {
    fontSize: '14px',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  stepInput: {
    width: '60px',
    padding: '8px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    textAlign: 'center',
  },
};
