# @manifesto-ai/compiler Examples

Practical examples for common use cases.

## Table of Contents

- [Basic Examples](#basic-examples)
  - [Counter App](#counter-app)
  - [Form Validation](#form-validation)
- [Intermediate Examples](#intermediate-examples)
  - [Shopping Cart](#shopping-cart)
  - [Conditional Logic](#conditional-logic)
- [Advanced Examples](#advanced-examples)
  - [Full Domain Compilation](#full-domain-compilation)
  - [Natural Language to Domain](#natural-language-to-domain)
  - [Patch Workflow](#patch-workflow)
  - [Conflict Resolution](#conflict-resolution)

---

## Basic Examples

### Counter App

A simple counter with derived values.

```typescript
import { createCompiler } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
});

const result = await compiler.compile({
  artifacts: [{
    id: 'counter',
    kind: 'code',
    language: 'ts',
    content: `
      // Counter state
      const count: number = 0;

      // Derived values
      const doubled = count * 2;
      const tripled = count * 3;
      const isPositive = count > 0;
      const isEven = count % 2 === 0;
    `,
  }],
});

// Expected fragments:
// - SchemaFragment: { count: number }
// - SourceFragment: data.count = 0
// - DerivedFragment: derived.doubled = count * 2
// - DerivedFragment: derived.tripled = count * 3
// - DerivedFragment: derived.isPositive = count > 0
// - DerivedFragment: derived.isEven = count % 2 === 0

console.log('Fragments:', result.fragments.length);
console.log('Domain paths:', result.domain ? Object.keys(result.domain.sources || {}) : 'N/A');
```

---

### Form Validation

Form fields with validation logic.

```typescript
import { createCompiler } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
});

const result = await compiler.compile({
  artifacts: [{
    id: 'user-form',
    kind: 'code',
    language: 'ts',
    content: `
      // User form data
      const email: string = '';
      const password: string = '';
      const confirmPassword: string = '';

      // Validation
      const isEmailValid = email.includes('@');
      const isPasswordLong = password.length >= 8;
      const passwordsMatch = password === confirmPassword;

      // Form validity
      const isFormValid = isEmailValid && isPasswordLong && passwordsMatch;
    `,
  }],
});

// Check for validation-related derived fragments
const derivedFragments = result.fragments.filter(f => f.kind === 'DerivedFragment');
console.log('Derived values:', derivedFragments.length);

// Verify no blocking issues
const errors = result.issues.filter(i => i.severity === 'error');
if (errors.length > 0) {
  console.log('Errors:', errors.map(e => e.message));
}
```

---

## Intermediate Examples

### Shopping Cart

E-commerce cart with totals and conditions.

```typescript
import { createCompiler, link, verify } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
});

const result = await compiler.compile({
  artifacts: [{
    id: 'shopping-cart',
    kind: 'code',
    language: 'ts',
    content: `
      // Cart data
      interface CartItem {
        id: string;
        name: string;
        price: number;
        quantity: number;
      }

      const items: CartItem[] = [];
      const discountCode: string = '';
      const discountPercent: number = 0;

      // Derived calculations
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const discountAmount = subtotal * (discountPercent / 100);
      const total = subtotal - discountAmount;

      // Conditions
      const hasItems = items.length > 0;
      const hasDiscount = discountPercent > 0;
      const canCheckout = hasItems && total > 0;
    `,
  }],
});

// Inspect the domain structure
if (result.domain) {
  console.log('Sources:', Object.keys(result.domain.sources || {}));
  console.log('Derived:', Object.keys(result.domain.derived || {}));
}

// Link and verify separately for more control
const fragments = await compiler.compileFragments({
  artifacts: result.fragments.length > 0 ? [] : [{
    id: 'cart',
    kind: 'code',
    language: 'ts',
    content: 'const total: number = 0;',
  }],
});

const linkResult = compiler.link(result.fragments);
const verifyResult = compiler.verify(linkResult);

console.log('Valid:', verifyResult.isValid);
console.log('Summary:', verifyResult.summary);
```

---

### Conditional Logic

Policies and conditional visibility.

```typescript
import { createCompiler } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
});

const result = await compiler.compile({
  artifacts: [{
    id: 'conditional-ui',
    kind: 'code',
    language: 'ts',
    content: `
      // User state
      const isLoggedIn: boolean = false;
      const userRole: string = 'guest';
      const isPremium: boolean = false;

      // Derived permissions
      const isAdmin = userRole === 'admin';
      const canEdit = isLoggedIn && (isAdmin || isPremium);
      const canDelete = isAdmin;
      const showPremiumFeatures = isPremium || isAdmin;

      // Conditional visibility (maps to PolicyFragment)
      const showDashboard = isLoggedIn;
      const showSettings = isLoggedIn && canEdit;
      const showAdminPanel = isAdmin;
    `,
  }],
});

// Filter for policy-related fragments
const policyFragments = result.fragments.filter(f =>
  f.kind === 'PolicyFragment' || f.kind === 'DerivedFragment'
);

console.log('Policy-related fragments:', policyFragments.length);

// Check dependencies
for (const frag of policyFragments) {
  console.log(`${frag.id}:`);
  console.log(`  Provides: ${frag.provides.join(', ')}`);
  console.log(`  Requires: ${frag.requires.join(', ')}`);
}
```

---

## Advanced Examples

### Full Domain Compilation

Complete domain with actions and effects.

```typescript
import { createCompiler, createPatch, replaceExprOp, generatedOrigin } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
});

// Step 1: Compile initial code
const result = await compiler.compile({
  artifacts: [{
    id: 'order-system',
    kind: 'code',
    language: 'ts',
    content: `
      // Order data schema
      interface Order {
        id: string;
        items: Array<{ productId: string; quantity: number; price: number }>;
        status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
        customerEmail: string;
      }

      const order: Order = {
        id: '',
        items: [],
        status: 'pending',
        customerEmail: '',
      };

      // Derived values
      const itemCount = order.items.length;
      const orderTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const hasItems = itemCount > 0;
      const isConfirmed = order.status === 'confirmed';
      const canShip = isConfirmed && hasItems;

      // Validation
      const isEmailValid = order.customerEmail.includes('@');
      const canConfirm = hasItems && isEmailValid && order.status === 'pending';
    `,
  }],
});

console.log('Initial compilation:');
console.log(`  Fragments: ${result.fragments.length}`);
console.log(`  Issues: ${result.issues.length}`);
console.log(`  Conflicts: ${result.conflicts.length}`);

// Step 2: Check for issues and suggest patches
if (result.issues.length > 0) {
  const hints = compiler.suggestPatches(result.issues, result.conflicts);
  console.log(`\nSuggested fixes: ${hints.length}`);
  for (const hint of hints) {
    console.log(`  - ${hint.description}`);
  }
}

// Step 3: Apply a patch to modify behavior
const orderTotalFragment = result.fragments.find(f =>
  f.provides.includes('derived.orderTotal')
);

if (orderTotalFragment) {
  const patch = createPatch(
    [
      // Add tax calculation (10%)
      replaceExprOp(orderTotalFragment.id, [
        '*',
        ['reduce', ['get', 'data.order.items'],
          ['+', ['get', 'acc'], ['*', ['get', 'item.price'], ['get', 'item.quantity']]],
          0
        ],
        1.1 // Add 10% tax
      ]),
    ],
    generatedOrigin('add-tax')
  );

  const patchResult = compiler.applyPatch(result.fragments, patch);
  console.log(`\nPatch applied: ${patchResult.ok}`);

  if (patchResult.ok) {
    // Relink and verify
    const newLinkResult = compiler.link(patchResult.fragments);
    const newVerifyResult = compiler.verify(newLinkResult);
    console.log(`After patch - Valid: ${newVerifyResult.isValid}`);
  }
}
```

---

### Natural Language to Domain

Using LLM adapter to compile natural language requirements.

```typescript
import { createCompiler, createAnthropicAdapter } from '@manifesto-ai/compiler';

// Create compiler with LLM support
const compiler = createCompiler({
  coreVersion: '0.3.0',
  llmAdapter: createAnthropicAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.1,
  }),
});

// Compile from natural language
const result = await compiler.compile({
  artifacts: [{
    id: 'requirements',
    kind: 'text',
    format: 'markdown',
    content: `
# Task Management System

## Data Model
- Tasks have a title, description, due date, and status
- Status can be: todo, in-progress, done, or cancelled
- Each task has an assignee (user email)

## Business Rules
- A task can only be marked as done if it has an assignee
- Overdue tasks are those past due date and not done
- Tasks can be cancelled at any time

## Computed Values
- Count of open tasks (not done or cancelled)
- Count of overdue tasks
- Whether the task list is empty
    `,
  }],
});

console.log('NL Compilation Result:');
console.log(`  Fragments: ${result.fragments.length}`);

// LLM-generated fragments have lower confidence
const llmFragments = result.fragments.filter(f => f.confidence < 1.0);
console.log(`  LLM-generated: ${llmFragments.length}`);

// Check provenance
for (const frag of llmFragments.slice(0, 3)) {
  console.log(`\n  ${frag.kind}: ${frag.provides[0]}`);
  console.log(`    Confidence: ${frag.confidence}`);
  console.log(`    Origin: ${frag.origin.kind}`);
}

// Verify the result
const verifyResult = compiler.verify(compiler.link(result.fragments));
console.log(`\nVerification: ${verifyResult.summary}`);
```

---

### Patch Workflow

Incremental editing with patches.

```typescript
import {
  createCompiler,
  createPatch,
  applyPatches,
  replaceExprOp,
  addDepOp,
  removeFragmentOp,
  generatedOrigin,
  userOrigin,
} from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
});

// Initial compilation
const result = await compiler.compile({
  artifacts: [{
    id: 'pricing',
    kind: 'code',
    language: 'ts',
    content: `
      const basePrice: number = 100;
      const quantity: number = 1;
      const discountRate: number = 0;

      const subtotal = basePrice * quantity;
      const discount = subtotal * discountRate;
      const total = subtotal - discount;
    `,
  }],
});

let fragments = result.fragments;

// Patch 1: Change calculation logic
const patch1 = createPatch(
  [
    replaceExprOp(
      fragments.find(f => f.provides.includes('derived.total'))?.id || '',
      ['max', ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']], 0]
    ),
  ],
  userOrigin('developer')
);

// Patch 2: Add new dependency
const patch2 = createPatch(
  [
    addDepOp(
      fragments.find(f => f.provides.includes('derived.discount'))?.id || '',
      'data.membershipLevel'
    ),
  ],
  generatedOrigin('feature-add')
);

// Apply patches sequentially
for (const patch of [patch1, patch2]) {
  const patchResult = compiler.applyPatch(fragments, patch);
  if (patchResult.ok) {
    fragments = patchResult.fragments;
    console.log(`Patch applied: ${patch.ops.length} operation(s)`);
  } else {
    console.log('Patch failed:', patchResult.failed);
  }
}

// Verify final state
const finalLinkResult = compiler.link(fragments);
const finalVerifyResult = compiler.verify(finalLinkResult);

console.log('\nFinal state:');
console.log(`  Fragments: ${fragments.length}`);
console.log(`  Valid: ${finalVerifyResult.isValid}`);
console.log(`  Issues: ${finalVerifyResult.errorCount} errors, ${finalVerifyResult.warningCount} warnings`);
```

---

### Conflict Resolution

Handling and resolving path conflicts.

```typescript
import {
  createCompiler,
  createPatch,
  chooseConflictOp,
  createSourceFragment,
  createDerivedFragment,
  generatedOrigin,
} from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
});

// Manually create conflicting fragments
const fragments = [
  createSourceFragment({
    path: 'data.total',
    schema: { type: 'number' },
    defaultValue: 0,
    origin: generatedOrigin('source-a'),
  }),
  // Another fragment providing same path (conflict!)
  createDerivedFragment({
    path: 'derived.total', // Same base name
    deps: ['data.price', 'data.quantity'],
    expr: ['*', ['get', 'data.price'], ['get', 'data.quantity']],
    origin: generatedOrigin('source-b'),
  }),
  // Third provider for 'total'
  createDerivedFragment({
    path: 'derived.total', // Duplicate!
    deps: ['data.subtotal', 'data.tax'],
    expr: ['+', ['get', 'data.subtotal'], ['get', 'data.tax']],
    origin: generatedOrigin('source-c'),
  }),
];

// Link and detect conflicts
const linkResult = compiler.link(fragments);

console.log('Conflicts detected:', linkResult.conflicts.length);

for (const conflict of linkResult.conflicts) {
  console.log(`\nConflict: ${conflict.type}`);
  console.log(`  Target: ${conflict.target}`);
  console.log(`  Candidates: ${conflict.candidates.join(', ')}`);
  console.log(`  Description: ${conflict.description}`);

  if (conflict.suggestedResolutions) {
    console.log('  Suggested resolutions:');
    for (const hint of conflict.suggestedResolutions) {
      console.log(`    - ${hint.description}`);
    }
  }
}

// Resolve conflict by choosing a winner
if (linkResult.conflicts.length > 0) {
  const conflict = linkResult.conflicts[0];
  const chosenWinner = conflict.candidates[0]; // Choose first candidate

  const resolutionPatch = createPatch(
    [chooseConflictOp(conflict.id, chosenWinner)],
    generatedOrigin('conflict-resolution')
  );

  const resolved = compiler.applyPatch(linkResult.fragments, resolutionPatch);

  if (resolved.ok) {
    const newLinkResult = compiler.link(resolved.fragments);
    console.log(`\nAfter resolution:`);
    console.log(`  Conflicts remaining: ${newLinkResult.conflicts.length}`);
    console.log(`  Domain ready: ${!!newLinkResult.domain}`);
  }
}
```

---

## Session with Full Observability

Complete example with session tracking.

```typescript
import { createCompiler } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
});

const session = compiler.createSession();

// Track all phases
const phaseLog: string[] = [];
session.onPhaseChange((phase) => {
  phaseLog.push(`[${new Date().toISOString()}] Phase: ${phase}`);
});

// Track snapshot changes
session.onSnapshotChange((snapshot) => {
  console.log(`Snapshot update:`);
  console.log(`  Phase: ${snapshot.phase}`);
  console.log(`  Fragments: ${snapshot.fragmentsCount}`);
  console.log(`  Issues: ${snapshot.issues.length}`);
  console.log(`  Conflicts: ${snapshot.conflictsCount}`);
});

// Subscribe to specific path
session.subscribePath('state.progress', (value) => {
  console.log(`Progress: ${value}`);
});

// Subscribe to events
session.subscribeEvents('compiler', (event) => {
  console.log(`Event: ${event.type}`, event.payload);
});

// Compile
await session.compile({
  artifacts: [{
    id: 'app',
    kind: 'code',
    language: 'ts',
    content: `
      const count: number = 0;
      const doubled = count * 2;
    `,
  }],
});

// Review phase log
console.log('\nPhase history:');
for (const entry of phaseLog) {
  console.log(`  ${entry}`);
}

// Get final state
const finalSnapshot = session.getSnapshot();
console.log('\nFinal snapshot:');
console.log(`  Phase: ${finalSnapshot.phase}`);
console.log(`  Success: ${finalSnapshot.phase === 'done'}`);
```

---

## Using with React (bridge-react)

Integration with @manifesto-ai/bridge-react.

```typescript
import { createCompiler } from '@manifesto-ai/compiler';
import { createRuntime } from '@manifesto-ai/core';
import { RuntimeProvider, useValue, useAction } from '@manifesto-ai/bridge-react';

// 1. Compile to get domain
const compiler = createCompiler({ coreVersion: '0.3.0' });

const result = await compiler.compile({
  artifacts: [{
    id: 'counter-app',
    kind: 'code',
    language: 'ts',
    content: `
      const count: number = 0;
      const doubled = count * 2;
    `,
  }],
});

// 2. Create runtime from compiled domain
if (result.domain) {
  const runtime = createRuntime({
    domain: result.domain,
    initialData: { count: 0 },
  });

  // 3. Use in React
  function App() {
    return (
      <RuntimeProvider runtime={runtime} domain={result.domain}>
        <Counter />
      </RuntimeProvider>
    );
  }

  function Counter() {
    const { value: count } = useValue<number>('data.count');
    const { value: doubled } = useValue<number>('derived.doubled');

    return (
      <div>
        <p>Count: {count}</p>
        <p>Doubled: {doubled}</p>
      </div>
    );
  }
}
```

---

For more details, see:
- [API Reference](./API.md)
- [Architecture](./ARCHITECTURE.md)
- [Getting Started](./GETTING_STARTED.md)
