/**
 * Form Validation App
 *
 * Demonstrates field validation with derived values.
 */

import { useValue, useSetValue, useDerived } from '@manifesto-ai/bridge-react';
import type { SemanticPath } from '@manifesto-ai/core';

// ============================================================================
// Form Field Component
// ============================================================================

interface FormFieldProps {
  label: string;
  path: string;
  errorPath: string;
  type?: 'text' | 'email' | 'password';
}

function FormField({ label, path, errorPath, type = 'text' }: FormFieldProps) {
  const { value } = useValue<string>(path as SemanticPath);
  const { value: error } = useDerived<string>(errorPath as SemanticPath);
  const { setValue } = useSetValue();

  const hasError = error && error.length > 0;

  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(path as SemanticPath, e.target.value)}
        style={{
          ...styles.input,
          borderColor: hasError ? '#ef4444' : '#d1d5db',
        }}
      />
      {hasError && <span style={styles.error}>{error}</span>}
    </div>
  );
}

// ============================================================================
// Checkbox Field Component
// ============================================================================

function CheckboxField() {
  const { value } = useValue<boolean>('data.acceptTerms' as SemanticPath);
  const { value: error } = useDerived<string>('derived.termsError' as SemanticPath);
  const { setValue } = useSetValue();

  const hasError = error && error.length > 0;

  return (
    <div style={styles.checkboxField}>
      <label style={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => setValue('data.acceptTerms' as SemanticPath, e.target.checked)}
          style={styles.checkbox}
        />
        <span>I accept the terms and conditions</span>
      </label>
      {hasError && <span style={styles.error}>{error}</span>}
    </div>
  );
}

// ============================================================================
// Submit Button
// ============================================================================

function SubmitButton() {
  const { value: formValid } = useDerived<boolean>('derived.formValid' as SemanticPath);
  const { value: submitted } = useValue<boolean>('state.submitted' as SemanticPath);
  const { setValue } = useSetValue();

  if (submitted) {
    return (
      <div style={styles.success}>
        <span style={styles.successIcon}>✓</span>
        <span>Registration successful!</span>
        <button
          onClick={() => {
            setValue('data.email' as SemanticPath, '');
            setValue('data.password' as SemanticPath, '');
            setValue('data.confirmPassword' as SemanticPath, '');
            setValue('data.acceptTerms' as SemanticPath, false);
            setValue('state.submitted' as SemanticPath, false);
          }}
          style={styles.resetButton}
        >
          Reset Form
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        if (formValid) {
          setValue('state.submitted' as SemanticPath, true);
        }
      }}
      disabled={!formValid}
      style={{
        ...styles.submitButton,
        opacity: formValid ? 1 : 0.5,
        cursor: formValid ? 'pointer' : 'not-allowed',
      }}
    >
      Register
    </button>
  );
}

// ============================================================================
// Validation Status
// ============================================================================

function ValidationStatus() {
  const { value: emailValid } = useDerived<boolean>('derived.emailValid' as SemanticPath);
  const { value: passwordValid } = useDerived<boolean>('derived.passwordValid' as SemanticPath);
  const { value: confirmValid } = useDerived<boolean>('derived.confirmPasswordValid' as SemanticPath);
  const { value: termsAccepted } = useValue<boolean>('data.acceptTerms' as SemanticPath);
  const { value: formValid } = useDerived<boolean>('derived.formValid' as SemanticPath);

  const checks = [
    { label: 'Valid email', valid: emailValid },
    { label: 'Password 8+ chars', valid: passwordValid },
    { label: 'Passwords match', valid: confirmValid },
    { label: 'Terms accepted', valid: termsAccepted },
  ];

  return (
    <div style={styles.status}>
      <h3 style={styles.statusTitle}>Validation Status</h3>
      <div style={styles.checkList}>
        {checks.map((check) => (
          <div key={check.label} style={styles.checkItem}>
            <span
              style={{
                ...styles.checkIcon,
                color: check.valid ? '#10b981' : '#9ca3af',
              }}
            >
              {check.valid ? '✓' : '○'}
            </span>
            <span
              style={{
                color: check.valid ? '#10b981' : '#6b7280',
              }}
            >
              {check.label}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          ...styles.statusBadge,
          backgroundColor: formValid ? '#dcfce7' : '#fef2f2',
          color: formValid ? '#166534' : '#991b1b',
        }}
      >
        {formValid ? 'Form Ready' : 'Incomplete'}
      </div>
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================

export default function App() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Registration Form</h1>
      <p style={styles.subtitle}>Form validation with @manifesto-ai/core</p>

      <div style={styles.formContent}>
        <div style={styles.form}>
          <FormField label="Email" path="data.email" errorPath="derived.emailError" type="email" />
          <FormField
            label="Password"
            path="data.password"
            errorPath="derived.passwordError"
            type="password"
          />
          <FormField
            label="Confirm Password"
            path="data.confirmPassword"
            errorPath="derived.confirmPasswordError"
            type="password"
          />
          <CheckboxField />
          <SubmitButton />
        </div>

        <ValidationStatus />
      </div>
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
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: '24px',
  },
  formContent: {
    display: 'grid',
    gap: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    padding: '10px 12px',
    fontSize: '16px',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  error: {
    fontSize: '12px',
    color: '#ef4444',
  },
  checkboxField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '8px',
    marginTop: '8px',
    transition: 'opacity 0.2s',
  },
  success: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '24px',
    backgroundColor: '#dcfce7',
    borderRadius: '8px',
  },
  successIcon: {
    fontSize: '32px',
    color: '#10b981',
  },
  resetButton: {
    padding: '8px 16px',
    fontSize: '14px',
    color: '#374151',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  status: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
  statusTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px',
  },
  checkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  checkIcon: {
    fontSize: '16px',
  },
  statusBadge: {
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'center',
  },
};
