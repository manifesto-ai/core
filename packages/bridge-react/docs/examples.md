# @manifesto-ai/bridge-react Examples

Practical examples for common use cases.

## Table of Contents

- [Basic Counter](#basic-counter)
- [Form with Validation](#form-with-validation)
- [Conditional Fields](#conditional-fields)
- [Action with Preconditions](#action-with-preconditions)
- [Shopping Cart](#shopping-cart)
- [Multi-Step Wizard](#multi-step-wizard)
- [Real-time Updates](#real-time-updates)

---

## Basic Counter

Simple counter demonstrating basic value reading and writing.

```tsx
import { z } from 'zod';
import { defineDomain, defineSource, createRuntime } from '@manifesto-ai/core';
import { RuntimeProvider, useValue, useSetValue } from '@manifesto-ai/bridge-react';

// Domain definition
const counterDomain = defineDomain({
  id: 'counter',
  name: 'Counter',
  dataSchema: z.object({ count: z.number() }),
  stateSchema: z.object({}),
  initialState: {},
  paths: {
    sources: {
      count: defineSource({
        schema: z.number(),
        defaultValue: 0,
        semantic: { type: 'number', description: 'Current count' },
      }),
    },
  },
});

// Component
function Counter() {
  const { value: count } = useValue<number>('data.count');
  const { setValue } = useSetValue();

  return (
    <div className="counter">
      <button onClick={() => setValue('data.count', count - 1)}>-</button>
      <span>{count}</span>
      <button onClick={() => setValue('data.count', count + 1)}>+</button>
    </div>
  );
}

// App
function App() {
  const runtime = createRuntime({ domain: counterDomain, initialData: { count: 0 } });

  return (
    <RuntimeProvider runtime={runtime} domain={counterDomain}>
      <Counter />
    </RuntimeProvider>
  );
}
```

---

## Form with Validation

Form handling with error states and submission.

```tsx
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineAction,
  setValue,
  createRuntime,
} from '@manifesto-ai/core';
import {
  RuntimeProvider,
  useValue,
  useSetValue,
  useAction,
} from '@manifesto-ai/bridge-react';

const userFormDomain = defineDomain({
  id: 'user-form',
  name: 'User Form',
  dataSchema: z.object({
    user: z.object({
      name: z.string(),
      email: z.string(),
      age: z.number(),
    }),
  }),
  stateSchema: z.object({
    submitted: z.boolean(),
  }),
  initialState: { submitted: false },
  paths: {
    sources: {
      'user.name': defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'User name' },
      }),
      'user.email': defineSource({
        schema: z.string().email(),
        defaultValue: '',
        semantic: { type: 'string', description: 'Email address' },
      }),
      'user.age': defineSource({
        schema: z.number().min(0).max(150),
        defaultValue: 0,
        semantic: { type: 'number', description: 'User age' },
      }),
    },
  },
  actions: {
    submit: defineAction({
      deps: ['data.user.name', 'data.user.email'],
      effect: setValue('state.submitted', true),
      semantic: { type: 'action', description: 'Submit form', risk: 'low' },
    }),
    reset: defineAction({
      effect: setValue('state.submitted', false),
      semantic: { type: 'action', description: 'Reset form', risk: 'low' },
    }),
  },
});

function UserForm() {
  const { value: name } = useValue<string>('data.user.name');
  const { value: email } = useValue<string>('data.user.email');
  const { value: age } = useValue<number>('data.user.age');
  const { value: submitted } = useValue<boolean>('state.submitted');

  const { setValue, error } = useSetValue();
  const { execute: submit, isExecuting } = useAction('submit');
  const { execute: reset } = useAction('reset');

  if (submitted) {
    return (
      <div className="success">
        <h2>Form Submitted!</h2>
        <p>Name: {name}</p>
        <p>Email: {email}</p>
        <p>Age: {age}</p>
        <button onClick={() => reset()}>Reset</button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="field">
        <label>Name</label>
        <input
          value={name}
          onChange={(e) => setValue('data.user.name', e.target.value)}
          placeholder="Enter your name"
        />
      </div>

      <div className="field">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setValue('data.user.email', e.target.value)}
          placeholder="Enter your email"
        />
      </div>

      <div className="field">
        <label>Age</label>
        <input
          type="number"
          value={age}
          onChange={(e) => setValue('data.user.age', Number(e.target.value))}
          min={0}
          max={150}
        />
      </div>

      {error && <p className="error">{error.message}</p>}

      <button type="submit" disabled={isExecuting}>
        {isExecuting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

---

## Conditional Fields

Fields that appear/disappear based on other values.

```tsx
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
  createRuntime,
} from '@manifesto-ai/core';
import {
  RuntimeProvider,
  useValue,
  useSetValue,
  useFieldPolicy,
} from '@manifesto-ai/bridge-react';

const orderDomain = defineDomain({
  id: 'order',
  name: 'Order Form',
  dataSchema: z.object({
    orderType: z.enum(['standard', 'gift', 'business']),
    recipientName: z.string(),
    businessName: z.string(),
    taxId: z.string(),
  }),
  stateSchema: z.object({}),
  initialState: {},
  paths: {
    sources: {
      orderType: defineSource({
        schema: z.enum(['standard', 'gift', 'business']),
        defaultValue: 'standard',
        semantic: { type: 'enum', description: 'Order type' },
      }),
      recipientName: defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'Gift recipient' },
        policy: {
          relevant: ['===', ['get', 'data.orderType'], 'gift'],
          required: ['===', ['get', 'data.orderType'], 'gift'],
        },
      }),
      businessName: defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'Business name' },
        policy: {
          relevant: ['===', ['get', 'data.orderType'], 'business'],
          required: ['===', ['get', 'data.orderType'], 'business'],
        },
      }),
      taxId: defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'Tax ID' },
        policy: {
          relevant: ['===', ['get', 'data.orderType'], 'business'],
          required: ['===', ['get', 'data.orderType'], 'business'],
        },
      }),
    },
  },
});

function ConditionalField({
  path,
  label,
  type = 'text',
}: {
  path: string;
  label: string;
  type?: string;
}) {
  const policy = useFieldPolicy(path);
  const { value } = useValue<string>(path);
  const { setValue } = useSetValue();

  // Don't render if not relevant
  if (!policy.relevant) return null;

  return (
    <div className="field">
      <label>
        {label}
        {policy.required && <span className="required">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(path, e.target.value)}
        disabled={!policy.editable}
        required={policy.required}
      />
    </div>
  );
}

function OrderForm() {
  const { value: orderType } = useValue<string>('data.orderType');
  const { setValue } = useSetValue();

  return (
    <form>
      <div className="field">
        <label>Order Type</label>
        <select
          value={orderType}
          onChange={(e) => setValue('data.orderType', e.target.value)}
        >
          <option value="standard">Standard</option>
          <option value="gift">Gift</option>
          <option value="business">Business</option>
        </select>
      </div>

      <ConditionalField path="data.recipientName" label="Recipient Name" />
      <ConditionalField path="data.businessName" label="Business Name" />
      <ConditionalField path="data.taxId" label="Tax ID" />
    </form>
  );
}
```

---

## Action with Preconditions

Actions that are only available when certain conditions are met.

```tsx
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
  defineAction,
  condition,
  setValue,
  createRuntime,
} from '@manifesto-ai/core';
import {
  RuntimeProvider,
  useValue,
  useSetValue,
  useAction,
  useActionAvailability,
} from '@manifesto-ai/bridge-react';

const checkoutDomain = defineDomain({
  id: 'checkout',
  name: 'Checkout',
  dataSchema: z.object({
    items: z.array(z.object({ id: z.string(), price: z.number() })),
    acceptedTerms: z.boolean(),
    paymentMethod: z.string(),
  }),
  stateSchema: z.object({
    processing: z.boolean(),
  }),
  initialState: { processing: false },
  paths: {
    sources: {
      items: defineSource({
        schema: z.array(z.object({ id: z.string(), price: z.number() })),
        defaultValue: [],
        semantic: { type: 'array', description: 'Cart items' },
      }),
      acceptedTerms: defineSource({
        schema: z.boolean(),
        defaultValue: false,
        semantic: { type: 'boolean', description: 'Terms acceptance' },
      }),
      paymentMethod: defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'Payment method' },
      }),
    },
    derived: {
      hasItems: defineDerived({
        deps: ['data.items'],
        expr: ['>', ['length', ['get', 'data.items']], 0],
        semantic: { type: 'boolean', description: 'Has items in cart' },
      }),
      hasPayment: defineDerived({
        deps: ['data.paymentMethod'],
        expr: ['!==', ['get', 'data.paymentMethod'], ''],
        semantic: { type: 'boolean', description: 'Has payment method' },
      }),
    },
  },
  actions: {
    checkout: defineAction({
      deps: ['data.items', 'data.acceptedTerms', 'data.paymentMethod'],
      effect: setValue('state.processing', true),
      preconditions: [
        condition('derived.hasItems', {
          expect: 'true',
          reason: 'Cart must have items',
        }),
        condition('data.acceptedTerms', {
          expect: 'true',
          reason: 'You must accept the terms and conditions',
        }),
        condition('derived.hasPayment', {
          expect: 'true',
          reason: 'Please select a payment method',
        }),
      ],
      semantic: { type: 'action', description: 'Complete checkout', risk: 'high' },
    }),
  },
});

function CheckoutButton() {
  const { execute, isExecuting, isAvailable } = useAction('checkout');
  const { blockedReasons } = useActionAvailability('checkout');

  return (
    <div className="checkout">
      <button
        onClick={() => execute()}
        disabled={!isAvailable || isExecuting}
        className={isAvailable ? 'available' : 'blocked'}
      >
        {isExecuting ? 'Processing...' : 'Complete Checkout'}
      </button>

      {blockedReasons.length > 0 && (
        <ul className="blocked-reasons">
          {blockedReasons.map((reason, i) => (
            <li key={i}>{reason.reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckoutForm() {
  const { value: acceptedTerms } = useValue<boolean>('data.acceptedTerms');
  const { value: paymentMethod } = useValue<string>('data.paymentMethod');
  const { setValue } = useSetValue();

  return (
    <div className="checkout-form">
      <div className="field">
        <label>Payment Method</label>
        <select
          value={paymentMethod}
          onChange={(e) => setValue('data.paymentMethod', e.target.value)}
        >
          <option value="">Select payment method...</option>
          <option value="credit">Credit Card</option>
          <option value="paypal">PayPal</option>
          <option value="bank">Bank Transfer</option>
        </select>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setValue('data.acceptedTerms', e.target.checked)}
        />
        I accept the terms and conditions
      </label>

      <CheckoutButton />
    </div>
  );
}
```

---

## Shopping Cart

Complete shopping cart with item management.

```tsx
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
  createRuntime,
} from '@manifesto-ai/core';
import {
  RuntimeProvider,
  useValue,
  useDerived,
  useSetValue,
} from '@manifesto-ai/bridge-react';

const cartItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
});

type CartItem = z.infer<typeof cartItemSchema>;

const cartDomain = defineDomain({
  id: 'shopping-cart',
  name: 'Shopping Cart',
  dataSchema: z.object({
    items: z.array(cartItemSchema),
  }),
  stateSchema: z.object({}),
  initialState: {},
  paths: {
    sources: {
      items: defineSource({
        schema: z.array(cartItemSchema),
        defaultValue: [],
        semantic: { type: 'array', description: 'Cart items' },
      }),
    },
    derived: {
      totalItems: defineDerived({
        deps: ['data.items'],
        expr: ['reduce', ['get', 'data.items'], ['fn', ['acc', 'item'], ['+', 'acc', ['get', 'item', 'quantity']]], 0],
        semantic: { type: 'number', description: 'Total item count' },
      }),
      totalPrice: defineDerived({
        deps: ['data.items'],
        expr: ['reduce', ['get', 'data.items'], ['fn', ['acc', 'item'], ['+', 'acc', ['*', ['get', 'item', 'price'], ['get', 'item', 'quantity']]]], 0],
        semantic: { type: 'number', description: 'Total price' },
      }),
    },
  },
});

function CartItem({ item, onUpdate, onRemove }: {
  item: CartItem;
  onUpdate: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="cart-item">
      <span className="name">{item.name}</span>
      <span className="price">${item.price.toFixed(2)}</span>
      <input
        type="number"
        value={item.quantity}
        onChange={(e) => onUpdate(Number(e.target.value))}
        min={1}
        max={99}
      />
      <span className="subtotal">
        ${(item.price * item.quantity).toFixed(2)}
      </span>
      <button onClick={onRemove}>Remove</button>
    </div>
  );
}

function ShoppingCart() {
  const { value: items } = useValue<CartItem[]>('data.items');
  const { value: totalItems } = useDerived<number>('derived.totalItems');
  const { value: totalPrice } = useDerived<number>('derived.totalPrice');
  const { setValue } = useSetValue();

  const updateQuantity = (id: string, quantity: number) => {
    const updated = items.map(item =>
      item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
    );
    setValue('data.items', updated);
  };

  const removeItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    setValue('data.items', updated);
  };

  const addItem = (item: Omit<CartItem, 'quantity'>) => {
    const existing = items.find(i => i.id === item.id);
    if (existing) {
      updateQuantity(item.id, existing.quantity + 1);
    } else {
      setValue('data.items', [...items, { ...item, quantity: 1 }]);
    }
  };

  return (
    <div className="shopping-cart">
      <h2>Shopping Cart ({totalItems} items)</h2>

      {items.length === 0 ? (
        <p>Your cart is empty</p>
      ) : (
        <>
          <div className="items">
            {items.map(item => (
              <CartItem
                key={item.id}
                item={item}
                onUpdate={(q) => updateQuantity(item.id, q)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>

          <div className="summary">
            <span>Total:</span>
            <span className="total">${totalPrice.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## Multi-Step Wizard

Form wizard with step navigation.

```tsx
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
  createRuntime,
} from '@manifesto-ai/core';
import {
  RuntimeProvider,
  useValue,
  useDerived,
  useSetValue,
  useFieldPolicy,
} from '@manifesto-ai/bridge-react';

const wizardDomain = defineDomain({
  id: 'wizard',
  name: 'Registration Wizard',
  dataSchema: z.object({
    step: z.number(),
    personal: z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
    }),
    address: z.object({
      street: z.string(),
      city: z.string(),
      zipCode: z.string(),
    }),
    preferences: z.object({
      newsletter: z.boolean(),
      notifications: z.boolean(),
    }),
  }),
  stateSchema: z.object({}),
  initialState: {},
  paths: {
    sources: {
      step: defineSource({
        schema: z.number(),
        defaultValue: 1,
        semantic: { type: 'number', description: 'Current step' },
      }),
      'personal.firstName': defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'First name' },
      }),
      'personal.lastName': defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'Last name' },
      }),
      'personal.email': defineSource({
        schema: z.string().email(),
        defaultValue: '',
        semantic: { type: 'string', description: 'Email' },
      }),
      'address.street': defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'Street' },
      }),
      'address.city': defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'City' },
      }),
      'address.zipCode': defineSource({
        schema: z.string(),
        defaultValue: '',
        semantic: { type: 'string', description: 'Zip code' },
      }),
      'preferences.newsletter': defineSource({
        schema: z.boolean(),
        defaultValue: false,
        semantic: { type: 'boolean', description: 'Newsletter subscription' },
      }),
      'preferences.notifications': defineSource({
        schema: z.boolean(),
        defaultValue: true,
        semantic: { type: 'boolean', description: 'Email notifications' },
      }),
    },
    derived: {
      isStep1Complete: defineDerived({
        deps: ['data.personal.firstName', 'data.personal.lastName', 'data.personal.email'],
        expr: ['and',
          ['!==', ['get', 'data.personal.firstName'], ''],
          ['!==', ['get', 'data.personal.lastName'], ''],
          ['!==', ['get', 'data.personal.email'], ''],
        ],
        semantic: { type: 'boolean', description: 'Step 1 complete' },
      }),
      isStep2Complete: defineDerived({
        deps: ['data.address.street', 'data.address.city', 'data.address.zipCode'],
        expr: ['and',
          ['!==', ['get', 'data.address.street'], ''],
          ['!==', ['get', 'data.address.city'], ''],
          ['!==', ['get', 'data.address.zipCode'], ''],
        ],
        semantic: { type: 'boolean', description: 'Step 2 complete' },
      }),
    },
  },
});

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ['Personal Info', 'Address', 'Preferences'];

  return (
    <div className="steps">
      {steps.map((label, i) => (
        <div
          key={i}
          className={`step ${i + 1 === currentStep ? 'active' : ''} ${i + 1 < currentStep ? 'completed' : ''}`}
        >
          <span className="number">{i + 1}</span>
          <span className="label">{label}</span>
        </div>
      ))}
    </div>
  );
}

function PersonalInfoStep() {
  const { value: firstName } = useValue<string>('data.personal.firstName');
  const { value: lastName } = useValue<string>('data.personal.lastName');
  const { value: email } = useValue<string>('data.personal.email');
  const { setValue } = useSetValue();

  return (
    <div className="step-content">
      <h3>Personal Information</h3>
      <input
        placeholder="First Name"
        value={firstName}
        onChange={(e) => setValue('data.personal.firstName', e.target.value)}
      />
      <input
        placeholder="Last Name"
        value={lastName}
        onChange={(e) => setValue('data.personal.lastName', e.target.value)}
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setValue('data.personal.email', e.target.value)}
      />
    </div>
  );
}

function WizardNavigation() {
  const { value: step } = useValue<number>('data.step');
  const { value: isStep1Complete } = useDerived<boolean>('derived.isStep1Complete');
  const { value: isStep2Complete } = useDerived<boolean>('derived.isStep2Complete');
  const { setValue } = useSetValue();

  const canGoNext = step === 1 ? isStep1Complete :
                    step === 2 ? isStep2Complete :
                    true;

  return (
    <div className="navigation">
      <button
        onClick={() => setValue('data.step', step - 1)}
        disabled={step === 1}
      >
        Previous
      </button>

      {step < 3 ? (
        <button
          onClick={() => setValue('data.step', step + 1)}
          disabled={!canGoNext}
        >
          Next
        </button>
      ) : (
        <button
          onClick={() => console.log('Submit!')}
          disabled={!canGoNext}
        >
          Submit
        </button>
      )}
    </div>
  );
}

function Wizard() {
  const { value: step } = useValue<number>('data.step');

  return (
    <div className="wizard">
      <StepIndicator currentStep={step} />

      {step === 1 && <PersonalInfoStep />}
      {step === 2 && <AddressStep />}
      {step === 3 && <PreferencesStep />}

      <WizardNavigation />
    </div>
  );
}
```

---

## Real-time Updates

Using subscriptions for real-time UI updates.

```tsx
import { useEffect, useState } from 'react';
import {
  RuntimeProvider,
  useRuntime,
  useValue,
} from '@manifesto-ai/bridge-react';

function RealTimeDisplay() {
  const { value: data } = useValue<Record<string, unknown>>('data');
  const [updates, setUpdates] = useState<string[]>([]);
  const runtime = useRuntime();

  useEffect(() => {
    const unsubscribe = runtime.subscribe(() => {
      const timestamp = new Date().toISOString();
      setUpdates(prev => [...prev.slice(-9), `Update at ${timestamp}`]);
    });

    return unsubscribe;
  }, [runtime]);

  return (
    <div className="real-time">
      <div className="data">
        <h3>Current Data</h3>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>

      <div className="updates">
        <h3>Recent Updates</h3>
        <ul>
          {updates.map((update, i) => (
            <li key={i}>{update}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```
