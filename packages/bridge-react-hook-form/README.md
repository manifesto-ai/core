# @manifesto-ai/bridge-react-hook-form

> React Hook Form integration for Manifesto AI Bridge

Seamlessly connect React Hook Form with Manifesto runtime using a convenient React hook.

## Installation

```bash
pnpm add @manifesto-ai/bridge-react-hook-form @manifesto-ai/bridge @manifesto-ai/core react-hook-form
```

## Quick Start

```tsx
import { useForm } from 'react-hook-form';
import { useMemo } from 'react';
import { createRuntime, defineDomain, defineDerived, z } from '@manifesto-ai/core';
import { useManifestoBridge, executeAction } from '@manifesto-ai/bridge-react-hook-form';

// Define domain
const formDomain = defineDomain('signup', {
  dataSchema: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string()
  }),

  derived: {
    'derived.passwordsMatch': defineDerived(
      { $eq: [{ $get: 'data.password' }, { $get: 'data.confirmPassword' }] },
      z.boolean()
    ),
    'derived.canSubmit': defineDerived(
      {
        $and: [
          { $gt: [{ $size: { $get: 'data.email' } }, 0] },
          { $gte: [{ $size: { $get: 'data.password' } }, 8] },
          { $get: 'derived.passwordsMatch' }
        ]
      },
      z.boolean()
    )
  }
});

function SignupForm() {
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  const runtime = useMemo(() => createRuntime(formDomain), []);
  const bridge = useManifestoBridge(form, runtime);

  const handleSubmit = form.handleSubmit(async (data) => {
    if (bridge.isActionAvailable('submit')) {
      await bridge.execute(executeAction('submit'));
    }
  });

  return (
    <form onSubmit={handleSubmit}>
      <input {...form.register('email')} placeholder="Email" />
      <input {...form.register('password')} type="password" placeholder="Password" />
      <input {...form.register('confirmPassword')} type="password" placeholder="Confirm Password" />

      <button type="submit" disabled={!bridge.isActionAvailable('submit')}>
        Sign Up
      </button>
    </form>
  );
}
```

## API Reference

### `useManifestoBridge(form, runtime, options?)`

React hook that creates and manages a Manifesto Bridge with React Hook Form.

```typescript
interface UseManifestoBridgeOptions {
  // Sync direction: 'push', 'pull', or 'bidirectional' (default)
  syncMode?: 'push' | 'pull' | 'bidirectional';

  // Auto-sync when form values change (default: true)
  autoSync?: boolean;

  // Debounce sync in milliseconds (default: 0)
  debounceMs?: number;
}
```

**Returns:** A `Bridge` instance with the following methods:

```typescript
interface Bridge {
  // Execute a command
  execute(command: Command): Promise<Result<void>>;

  // Check if an action is available
  isActionAvailable(actionId: string): boolean;

  // Subscribe to state changes
  subscribe(listener: (snapshot) => void): () => void;

  // Get current snapshot
  getSnapshot(): { data: unknown; state: unknown };

  // Cleanup
  dispose(): void;
}
```

**Example:**

```tsx
function MyForm() {
  const form = useForm();
  const runtime = useMemo(() => createRuntime(domain), []);

  const bridge = useManifestoBridge(form, runtime, {
    syncMode: 'bidirectional',
    autoSync: true,
    debounceMs: 100  // Debounce syncs by 100ms
  });

  // Bridge automatically syncs form values with runtime
  // and validates using domain rules
}
```

### `createReactHookFormAdapter(form)`

Creates an adapter that reads from React Hook Form.

```typescript
const adapter = createReactHookFormAdapter(form);

// Reads form values as 'data.*' paths
adapter.getData('data.email');  // Returns form field value

// Gets validation errors as ValidationResult
adapter.getValidity('data.email');
// { valid: false, issues: [{ code: 'email', message: 'Invalid email', ... }] }

// Captures all form data
adapter.captureData();
// { 'data.email': 'user@example.com', 'data.password': '...' }
```

### `createReactHookFormActuator(form)`

Creates an actuator that writes to React Hook Form.

```typescript
const actuator = createReactHookFormActuator(form);

// Sets form field value
actuator.setData('data.email', 'new@example.com');
// Triggers validation, marks as dirty and touched

// Focus a field
actuator.focus('data.email');

// Set multiple values at once
actuator.setManyData({
  'data.firstName': 'John',
  'data.lastName': 'Doe'
});
```

## Full Example: Multi-Step Form

```tsx
import { useForm } from 'react-hook-form';
import { useMemo, useState, useEffect } from 'react';
import { createRuntime, defineDomain, defineDerived, defineAction, setValue, z } from '@manifesto-ai/core';
import { useManifestoBridge, executeAction } from '@manifesto-ai/bridge-react-hook-form';

const wizardDomain = defineDomain('wizard', {
  dataSchema: z.object({
    // Step 1: Personal Info
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    // Step 2: Address
    street: z.string(),
    city: z.string(),
    zipCode: z.string(),
    // Step 3: Payment
    cardNumber: z.string(),
    expiryDate: z.string()
  }),

  stateSchema: z.object({
    currentStep: z.number().default(1),
    isSubmitting: z.boolean().default(false)
  }),

  derived: {
    'derived.step1Complete': defineDerived(
      {
        $and: [
          { $gt: [{ $size: { $get: 'data.firstName' } }, 0] },
          { $gt: [{ $size: { $get: 'data.lastName' } }, 0] },
          { $test: [{ $get: 'data.email' }, '^[^@]+@[^@]+\\.[^@]+$'] }
        ]
      },
      z.boolean()
    ),
    'derived.step2Complete': defineDerived(
      {
        $and: [
          { $gt: [{ $size: { $get: 'data.street' } }, 0] },
          { $gt: [{ $size: { $get: 'data.city' } }, 0] },
          { $gt: [{ $size: { $get: 'data.zipCode' } }, 0] }
        ]
      },
      z.boolean()
    ),
    'derived.canProceed': defineDerived(
      {
        $if: [
          { $eq: [{ $get: 'state.currentStep' }, 1] },
          { $get: 'derived.step1Complete' },
          { $if: [
            { $eq: [{ $get: 'state.currentStep' }, 2] },
            { $get: 'derived.step2Complete' },
            true
          ]}
        ]
      },
      z.boolean()
    )
  },

  actions: {
    nextStep: defineAction({
      precondition: {
        $and: [
          { $get: 'derived.canProceed' },
          { $lt: [{ $get: 'state.currentStep' }, 3] }
        ]
      },
      effect: setValue('state.currentStep', {
        $add: [{ $get: 'state.currentStep' }, 1]
      })
    }),
    prevStep: defineAction({
      precondition: { $gt: [{ $get: 'state.currentStep' }, 1] },
      effect: setValue('state.currentStep', {
        $subtract: [{ $get: 'state.currentStep' }, 1]
      })
    })
  }
});

function WizardForm() {
  const form = useForm({
    defaultValues: {
      firstName: '', lastName: '', email: '',
      street: '', city: '', zipCode: '',
      cardNumber: '', expiryDate: ''
    }
  });

  const runtime = useMemo(() => createRuntime(wizardDomain), []);
  const bridge = useManifestoBridge(form, runtime);

  const [currentStep, setCurrentStep] = useState(1);
  const [canProceed, setCanProceed] = useState(false);

  useEffect(() => {
    const unsub1 = runtime.subscribe('state.currentStep', setCurrentStep);
    const unsub2 = runtime.subscribe('derived.canProceed', setCanProceed);
    return () => { unsub1(); unsub2(); };
  }, [runtime]);

  const handleNext = async () => {
    await bridge.execute(executeAction('nextStep'));
  };

  const handlePrev = async () => {
    await bridge.execute(executeAction('prevStep'));
  };

  return (
    <form>
      {currentStep === 1 && (
        <div>
          <h2>Step 1: Personal Info</h2>
          <input {...form.register('firstName')} placeholder="First Name" />
          <input {...form.register('lastName')} placeholder="Last Name" />
          <input {...form.register('email')} placeholder="Email" />
        </div>
      )}

      {currentStep === 2 && (
        <div>
          <h2>Step 2: Address</h2>
          <input {...form.register('street')} placeholder="Street" />
          <input {...form.register('city')} placeholder="City" />
          <input {...form.register('zipCode')} placeholder="ZIP Code" />
        </div>
      )}

      {currentStep === 3 && (
        <div>
          <h2>Step 3: Payment</h2>
          <input {...form.register('cardNumber')} placeholder="Card Number" />
          <input {...form.register('expiryDate')} placeholder="MM/YY" />
        </div>
      )}

      <div>
        {currentStep > 1 && (
          <button type="button" onClick={handlePrev}>
            Previous
          </button>
        )}
        {currentStep < 3 && (
          <button type="button" onClick={handleNext} disabled={!canProceed}>
            Next
          </button>
        )}
        {currentStep === 3 && (
          <button type="submit">
            Submit
          </button>
        )}
      </div>
    </form>
  );
}
```

## Integration with Form Validation

React Hook Form errors are automatically converted to Manifesto `ValidationResult`:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email format'),
  age: z.number().min(18, 'Must be 18 or older')
});

function ValidatedForm() {
  const form = useForm({
    resolver: zodResolver(schema)
  });

  const runtime = useMemo(() => createRuntime(domain), []);
  const bridge = useManifestoBridge(form, runtime);

  // RHF validation errors are available through the adapter
  // bridge.adapter.getValidity('data.email')
  // Returns: { valid: false, issues: [{ code: 'email', message: 'Invalid email format', ... }] }
}
```

## Re-exports

This package re-exports commonly used items from `@manifesto-ai/bridge`:

```typescript
export { createBridge, setValue, setMany, executeAction } from '@manifesto-ai/bridge';
export type { Adapter, Actuator, Bridge, Command, BridgeError } from '@manifesto-ai/bridge';
```

## Related Packages

- [@manifesto-ai/core](../core) - Core runtime and domain definitions
- [@manifesto-ai/bridge](../bridge) - Base bridge interfaces
- [@manifesto-ai/bridge-zustand](../bridge-zustand) - Zustand integration

## License

MIT
