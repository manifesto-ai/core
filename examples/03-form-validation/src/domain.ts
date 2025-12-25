/**
 * Form Validation Domain
 *
 * Demonstrates validation patterns with Manifesto:
 * - Field-level validation via derived paths
 * - Form-level validation (all fields valid)
 * - Actions for form state management
 */

import {
  defineDomain,
  z,
  type SemanticPath,
  type Expression,
  type Effect,
} from '@manifesto-ai/core';

// ============================================================================
// Type Definitions
// ============================================================================

export interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface FormState {
  submitted: boolean;
}

// ============================================================================
// Domain Definition
// ============================================================================

export const formDomain = defineDomain<FormData, FormState>({
  id: 'form-validation',
  name: 'Form Validation Example',
  description: 'Demonstrates form validation with derived paths',

  dataSchema: z.object({
    email: z.string(),
    password: z.string(),
    confirmPassword: z.string(),
    acceptTerms: z.boolean(),
  }),

  stateSchema: z.object({
    submitted: z.boolean(),
  }),

  initialState: {
    submitted: false,
  },

  paths: {
    sources: {
      'data.email': {
        schema: z.string(),
        semantic: { type: 'email', description: 'User email address' },
      },
      'data.password': {
        schema: z.string(),
        semantic: { type: 'password', description: 'User password' },
      },
      'data.confirmPassword': {
        schema: z.string(),
        semantic: { type: 'password', description: 'Password confirmation' },
      },
      'data.acceptTerms': {
        schema: z.boolean(),
        semantic: { type: 'checkbox', description: 'Terms acceptance' },
      },
      'state.submitted': {
        schema: z.boolean(),
        semantic: { type: 'status', description: 'Form submission status' },
      },
    },

    derived: {
      // Email validation - check if matches email pattern
      'derived.emailValid': {
        deps: ['data.email'] as SemanticPath[],
        expr: ['matches', ['get', 'data.email'], '^[^@]+@[^@]+\\.[^@]+$'] as Expression,
        semantic: { type: 'validation', description: 'Email format valid' },
      },

      // Email not empty
      'derived.emailNotEmpty': {
        deps: ['data.email'] as SemanticPath[],
        expr: ['>', ['length', ['get', 'data.email']], 0] as Expression,
        semantic: { type: 'validation', description: 'Email is not empty' },
      },

      // Password length validation (minimum 8 characters)
      'derived.passwordValid': {
        deps: ['data.password'] as SemanticPath[],
        expr: ['>=', ['length', ['get', 'data.password']], 8] as Expression,
        semantic: { type: 'validation', description: 'Password length valid' },
      },

      // Password not empty
      'derived.passwordNotEmpty': {
        deps: ['data.password'] as SemanticPath[],
        expr: ['>', ['length', ['get', 'data.password']], 0] as Expression,
        semantic: { type: 'validation', description: 'Password is not empty' },
      },

      // Confirm password matches password
      'derived.confirmPasswordValid': {
        deps: ['data.password', 'data.confirmPassword'] as SemanticPath[],
        expr: ['==', ['get', 'data.password'], ['get', 'data.confirmPassword']] as Expression,
        semantic: { type: 'validation', description: 'Passwords match' },
      },

      // Confirm password not empty
      'derived.confirmPasswordNotEmpty': {
        deps: ['data.confirmPassword'] as SemanticPath[],
        expr: ['>', ['length', ['get', 'data.confirmPassword']], 0] as Expression,
        semantic: { type: 'validation', description: 'Confirm password is not empty' },
      },

      // Form-level validation - all conditions must be true
      'derived.formValid': {
        deps: [
          'derived.emailValid',
          'derived.emailNotEmpty',
          'derived.passwordValid',
          'derived.passwordNotEmpty',
          'derived.confirmPasswordValid',
          'derived.confirmPasswordNotEmpty',
          'data.acceptTerms',
        ] as SemanticPath[],
        expr: [
          'all',
          ['get', 'derived.emailValid'],
          ['get', 'derived.emailNotEmpty'],
          ['get', 'derived.passwordValid'],
          ['get', 'derived.passwordNotEmpty'],
          ['get', 'derived.confirmPasswordValid'],
          ['get', 'derived.confirmPasswordNotEmpty'],
          ['get', 'data.acceptTerms'],
        ] as Expression,
        semantic: { type: 'validation', description: 'Entire form valid' },
      },

      // Can submit when form is valid
      'derived.canSubmit': {
        deps: ['derived.formValid', 'state.submitted'] as SemanticPath[],
        expr: [
          'all',
          ['get', 'derived.formValid'],
          ['!', ['get', 'state.submitted']],
        ] as Expression,
        semantic: { type: 'status', description: 'Form can be submitted' },
      },
    },

    async: {},
  },

  actions: {
    setEmail: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Set the email field value',
        verb: 'set',
      },
      effect: {
        _tag: 'SetValue',
        path: 'data.email',
        value: ['get', '$payload'] as Expression,
        description: 'Update email field',
      } as Effect,
    },
    setPassword: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Set the password field value',
        verb: 'set',
      },
      effect: {
        _tag: 'SetValue',
        path: 'data.password',
        value: ['get', '$payload'] as Expression,
        description: 'Update password field',
      } as Effect,
    },
    setConfirmPassword: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Set the confirm password field value',
        verb: 'set',
      },
      effect: {
        _tag: 'SetValue',
        path: 'data.confirmPassword',
        value: ['get', '$payload'] as Expression,
        description: 'Update confirm password field',
      } as Effect,
    },
    setAcceptTerms: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Set the terms acceptance checkbox',
        verb: 'set',
      },
      effect: {
        _tag: 'SetValue',
        path: 'data.acceptTerms',
        value: ['get', '$payload'] as Expression,
        description: 'Update terms acceptance',
      } as Effect,
    },
    submit: {
      deps: ['derived.formValid'] as SemanticPath[],
      preconditions: [{ path: 'derived.formValid' as SemanticPath, expect: 'true', reason: 'Form must be valid' }],
      semantic: {
        type: 'action',
        description: 'Submit the registration form',
        verb: 'submit',
      },
      effect: {
        _tag: 'SetState',
        path: 'state.submitted',
        value: true,
        description: 'Mark form as submitted',
      } as Effect,
    },
    reset: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Reset the form to initial state',
        verb: 'reset',
      },
      effect: {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.email', value: '', description: 'Clear email' },
          { _tag: 'SetValue', path: 'data.password', value: '', description: 'Clear password' },
          { _tag: 'SetValue', path: 'data.confirmPassword', value: '', description: 'Clear confirm password' },
          { _tag: 'SetValue', path: 'data.acceptTerms', value: false, description: 'Clear terms' },
          { _tag: 'SetState', path: 'state.submitted', value: false, description: 'Reset submitted' },
        ],
        description: 'Reset all form fields',
      } as Effect,
    },
  },
});

// ============================================================================
// Initial Data
// ============================================================================

export function getInitialFormData(): FormData {
  return {
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  };
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Get email error message based on validation state
 */
export function getEmailError(email: string, isValid: boolean): string {
  if (email === '') return 'Email is required';
  if (!isValid) return 'Invalid email format';
  return '';
}

/**
 * Get password error message based on validation state
 */
export function getPasswordError(password: string, isValid: boolean): string {
  if (password === '') return 'Password is required';
  if (!isValid) return 'Password must be at least 8 characters';
  return '';
}

/**
 * Get confirm password error message
 */
export function getConfirmPasswordError(confirmPassword: string, matches: boolean): string {
  if (confirmPassword === '') return 'Please confirm your password';
  if (!matches) return 'Passwords do not match';
  return '';
}

/**
 * Get terms error message
 */
export function getTermsError(accepted: boolean): string {
  if (!accepted) return 'You must accept the terms';
  return '';
}
