# Section 3 -- Semantic Path

## 3.1 Overview

A **SemanticPath** is a string that uniquely identifies a value within a domain. Paths provide a consistent addressing scheme that both humans and AI agents can understand.

---

## 3.2 SemanticPath Type

### 3.2.1 Type Definition

```typescript
type SemanticPath = string;
```

A SemanticPath is a string following specific syntax rules. While implemented as a plain string, conforming implementations **MUST** validate paths against the grammar defined in this section.

### 3.2.2 Grammar

```
SemanticPath : NamespacePrefix PathSegments?

NamespacePrefix : Namespace "."

Namespace : "data" | "state" | "derived" | "actions"

PathSegments : PathSegment ("." PathSegment)*

PathSegment : Identifier | IndexAccess | StringKeyAccess

Identifier : IdentifierStart IdentifierContinue*

IdentifierStart : [a-zA-Z_]

IdentifierContinue : [a-zA-Z0-9_]

IndexAccess : "[" Integer "]"

StringKeyAccess : "[" StringLiteral "]"

Integer : Digit+

Digit : [0-9]

StringLiteral : "\"" StringCharacter* "\"" | "'" StringCharacter* "'"

StringCharacter : ~["'\\] | "\\" EscapeSequence

EscapeSequence : "\"" | "'" | "\\" | "n" | "r" | "t"
```

---

## 3.3 Namespaces

Every SemanticPath **MUST** begin with a namespace prefix.

### 3.3.1 data Namespace

Paths beginning with `data.` refer to user input and domain data.

| Property | Value |
|----------|-------|
| Prefix | `data.` |
| Writable | Yes, via `SetValueEffect` |
| Persistent | Yes |
| Schema | Defined by `dataSchema` |

**Example № 1** *Data paths*

```
data.user.email
data.cart.items[0].quantity
data.order.shippingAddress.city
```

### 3.3.2 state Namespace

Paths beginning with `state.` refer to system and UI state.

| Property | Value |
|----------|-------|
| Prefix | `state.` |
| Writable | Yes, via `SetStateEffect` |
| Persistent | No (ephemeral) |
| Schema | Defined by `stateSchema` |

**Example № 2** *State paths*

```
state.isLoading
state.currentStep
state.error
state.shippingOptions
```

### 3.3.3 derived Namespace

Paths beginning with `derived.` refer to computed values.

| Property | Value |
|----------|-------|
| Prefix | `derived.` |
| Writable | No (read-only) |
| Persistent | No (computed) |
| Schema | Inferred from expression |

**Example № 3** *Derived paths*

```
derived.cartTotal
derived.isFormValid
derived.discountAmount
derived.estimatedDeliveryDate
```

### 3.3.4 actions Namespace

Paths beginning with `actions.` refer to executable actions.

| Property | Value |
|----------|-------|
| Prefix | `actions.` |
| Writable | No |
| Executable | Yes, via `execute()` |

**Example № 4** *Action paths*

```
actions.checkout
actions.addToCart
actions.removeItem
actions.applyDiscount
```

---

## 3.4 Path Segments

### 3.4.1 Identifiers

Identifiers are the most common path segment type.

- **MUST** start with a letter or underscore
- **MUST** contain only letters, digits, or underscores
- **MUST NOT** be empty

**Example № 5** *Valid identifiers*

```
user
firstName
_private
item123
MAX_VALUE
```

**Counter-example № 1** *Invalid identifiers*

```
123abc     // Cannot start with digit
first-name // Hyphens not allowed
my.path    // Dots are segment separators
```

### 3.4.2 Index Access

Array elements are accessed using bracket notation with integer indices.

- Indices **MUST** be non-negative integers
- Indices are zero-based

**Example № 6** *Index access*

```
data.items[0]
data.items[0].name
data.matrix[1][2]
```

### 3.4.3 String Key Access

Object properties with special characters can be accessed using string keys.

**Example № 7** *String key access*

```
data.config["api-key"]
data.translations["en-US"]
data.metrics["conversion.rate"]
```

---

## 3.5 Path Resolution

### 3.5.1 Resolution Algorithm

```
ResolvePath(snapshot, path):
1. Let {namespace} be the namespace prefix of {path}.
2. Let {segments} be ParsePath(RemoveNamespacePrefix({path})).
3. If {namespace} is "data":
   a. Return TraverseObject({snapshot}.data, {segments}).
4. If {namespace} is "state":
   a. Return TraverseObject({snapshot}.state, {segments}).
5. If {namespace} is "derived":
   a. Let {key} be JoinSegments({segments}).
   b. If {key} exists in {snapshot}.derived, return it.
   c. Return undefined.
6. If {namespace} is "actions":
   a. Return ActionReference({path}).
7. Return undefined.
```

### 3.5.2 TraverseObject

```
TraverseObject(obj, segments):
1. Let {current} be {obj}.
2. For each {segment} in {segments}:
   a. If {current} is null or undefined, return undefined.
   b. If {segment} is an integer and {current} is an array:
      i. Set {current} to {current}[{segment}].
   c. Else:
      i. Set {current} to {current}[{segment}].
3. Return {current}.
```

---

## 3.6 SemanticMeta

Each path **SHOULD** have associated metadata describing its purpose.

### 3.6.1 Type Definition

```typescript
type SemanticMeta = {
  type: string;
  description: string;
  importance?: 'critical' | 'high' | 'medium' | 'low';
  readable?: boolean;
  writable?: boolean;
  examples?: unknown[];
  hints?: Record<string, unknown>;
};
```

### 3.6.2 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Semantic type identifier |
| `description` | string | Yes | Human/AI-readable description |
| `importance` | enum | No | Value importance for AI prioritization |
| `readable` | boolean | No | Whether AI can read this value (default: true) |
| `writable` | boolean | No | Whether AI can modify this value (default: varies) |
| `examples` | unknown[] | No | Example values for AI understanding |
| `hints` | Record | No | Additional context for AI |

**Example № 8** *SemanticMeta for email field*

```typescript
{
  type: 'email',
  description: 'Customer email address for order confirmation',
  importance: 'critical',
  readable: true,
  writable: true,
  examples: ['customer@example.com'],
  hints: {
    validation: 'RFC 5322 compliant',
    purpose: 'order-confirmation'
  }
}
```

---

## 3.7 Path Definitions

### 3.7.1 SourceDefinition

Defines an external input path (data or state).

```typescript
type SourceDefinition = {
  schema: ZodType;
  defaultValue?: unknown;
  policy?: FieldPolicy;
  semantic: SemanticMeta;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema` | ZodType | Yes | Zod schema for validation |
| `defaultValue` | unknown | No | Default value |
| `policy` | FieldPolicy | No | Field visibility/editability policy |
| `semantic` | SemanticMeta | Yes | Semantic metadata |

**Example № 9** *Source definition*

```typescript
{
  schema: z.string().email(),
  defaultValue: '',
  policy: {
    editableWhen: [{ path: 'derived.isNotSubmitted', expect: 'true' }],
    requiredWhen: [{ path: 'state.step', expect: 'true', reason: 'Email required for checkout' }]
  },
  semantic: {
    type: 'email',
    description: 'Customer email address'
  }
}
```

### 3.7.2 DerivedDefinition

Defines a computed value path.

```typescript
type DerivedDefinition = {
  deps: SemanticPath[];
  expr: Expression;
  semantic: SemanticMeta;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deps` | SemanticPath[] | Yes | Paths this value depends on |
| `expr` | Expression | Yes | Computation expression |
| `semantic` | SemanticMeta | Yes | Semantic metadata |

**Example № 10** *Derived definition*

```typescript
{
  deps: ['data.cart.items'],
  expr: ['reduce', ['get', 'data.cart.items'],
    ['+', ['get', '$acc'], ['*', ['get', '$.price'], ['get', '$.quantity']]],
    0
  ],
  semantic: {
    type: 'currency',
    description: 'Total price of all items in cart'
  }
}
```

### 3.7.3 AsyncDefinition

Defines an asynchronous operation.

```typescript
type AsyncDefinition = {
  deps: SemanticPath[];
  condition?: Expression;
  debounce?: number;
  effect: Effect;
  resultPath: SemanticPath;
  loadingPath: SemanticPath;
  errorPath: SemanticPath;
  semantic: SemanticMeta;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deps` | SemanticPath[] | Yes | Trigger dependencies |
| `condition` | Expression | No | When to execute (default: always) |
| `debounce` | number | No | Debounce delay in milliseconds |
| `effect` | Effect | Yes | Effect to execute |
| `resultPath` | SemanticPath | Yes | Where to store result |
| `loadingPath` | SemanticPath | Yes | Loading state path |
| `errorPath` | SemanticPath | Yes | Error state path |
| `semantic` | SemanticMeta | Yes | Semantic metadata |

**Example № 11** *Async definition*

```typescript
{
  deps: ['data.postalCode'],
  condition: ['>=', ['length', ['get', 'data.postalCode']], 5],
  debounce: 300,
  effect: {
    _tag: 'ApiCall',
    endpoint: '/api/shipping-rates',
    method: 'GET',
    query: { postalCode: ['get', 'data.postalCode'] },
    description: 'Fetch shipping rates for postal code'
  },
  resultPath: 'state.shippingRates',
  loadingPath: 'state.isLoadingRates',
  errorPath: 'state.shippingRatesError',
  semantic: {
    type: 'api-fetch',
    description: 'Fetches available shipping rates based on postal code'
  }
}
```

### 3.7.4 ActionDefinition

Defines an executable action.

```typescript
type ActionDefinition = {
  deps: SemanticPath[];
  input?: ZodType;
  effect: Effect;
  preconditions?: ConditionRef[];
  semantic: ActionSemanticMeta;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deps` | SemanticPath[] | Yes | Dependencies for precondition evaluation |
| `input` | ZodType | No | Input parameter schema |
| `effect` | Effect | Yes | Effect to execute |
| `preconditions` | ConditionRef[] | No | Conditions for action availability |
| `semantic` | ActionSemanticMeta | Yes | Action semantic metadata |

### 3.7.5 ActionSemanticMeta

Extended metadata for actions.

```typescript
type ActionSemanticMeta = SemanticMeta & {
  verb: string;
  risk?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  expectedOutcome?: string;
  reversible?: boolean;
};
```

**Example № 12** *Action definition*

```typescript
{
  deps: ['derived.isCartValid', 'derived.hasItems'],
  input: z.object({
    paymentMethod: z.enum(['credit', 'debit', 'paypal'])
  }),
  effect: {
    _tag: 'Sequence',
    effects: [
      { _tag: 'SetState', path: 'state.isProcessing', value: true, description: 'Start processing' },
      { _tag: 'ApiCall', endpoint: '/api/checkout', method: 'POST', body: { cart: ['get', 'data.cart'] }, description: 'Submit order' }
    ],
    description: 'Process checkout'
  },
  preconditions: [
    { path: 'derived.isCartValid', expect: 'true', reason: 'Cart must be valid' },
    { path: 'derived.hasItems', expect: 'true', reason: 'Cart must have items' }
  ],
  semantic: {
    type: 'checkout',
    description: 'Complete the purchase and process payment',
    verb: 'checkout',
    risk: 'high',
    expectedOutcome: 'Order is placed and payment is processed',
    reversible: false
  }
}
```

---

## 3.8 ConditionRef

A reference to a condition for preconditions and policies.

```typescript
type ConditionRef = {
  path: SemanticPath;
  expect?: 'true' | 'false';
  reason?: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | SemanticPath | Yes | Path to check |
| `expect` | 'true' \| 'false' | No | Expected truthiness (default: 'true') |
| `reason` | string | No | Human/AI-readable explanation |

---

## 3.9 FieldPolicy

Controls field visibility and editability.

```typescript
type FieldPolicy = {
  relevantWhen?: ConditionRef[];
  editableWhen?: ConditionRef[];
  requiredWhen?: ConditionRef[];
};
```

| Field | Type | Description |
|-------|------|-------------|
| `relevantWhen` | ConditionRef[] | When this field is meaningful |
| `editableWhen` | ConditionRef[] | When this field can be modified |
| `requiredWhen` | ConditionRef[] | When this field must have a value |

**Example № 13** *Field policy*

```typescript
{
  relevantWhen: [
    { path: 'data.shippingMethod', expect: 'true', reason: 'Only relevant when shipping is selected' }
  ],
  editableWhen: [
    { path: 'state.isNotSubmitted', expect: 'true', reason: 'Cannot edit after submission' }
  ],
  requiredWhen: [
    { path: 'data.requiresShipping', expect: 'true', reason: 'Required for physical products' }
  ]
}
```

---

## 3.10 ManifestoDomain

The complete domain model definition.

```typescript
type ManifestoDomain<TData = unknown, TState = unknown> = {
  id: string;
  name: string;
  description: string;
  paths: PathDefinitions<TData, TState>;
  actions: Record<string, ActionDefinition>;
  dataSchema: ZodType<TData>;
  stateSchema: ZodType<TState>;
  initialState: TState;
  meta?: DomainMeta;
};
```

### 3.10.1 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique domain identifier |
| `name` | string | Human-readable name |
| `description` | string | Domain description |
| `paths` | PathDefinitions | All path definitions |
| `actions` | Record | Action definitions |
| `dataSchema` | ZodType | Zod schema for data |
| `stateSchema` | ZodType | Zod schema for state |
| `initialState` | TState | Initial state value |

### 3.10.2 Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `meta` | DomainMeta | Domain-level metadata |

### 3.10.3 DomainMeta

```typescript
type DomainMeta = {
  version?: string;
  category?: string;
  aiDescription?: string;
};
```

---

## 3.11 PathDefinitions

Container for all path definitions.

```typescript
type PathDefinitions<TData = unknown, TState = unknown> = {
  sources: Record<SemanticPath, SourceDefinition>;
  derived: Record<SemanticPath, DerivedDefinition>;
  async: Record<SemanticPath, AsyncDefinition>;
};
```

| Field | Type | Description |
|-------|------|-------------|
| `sources` | Record | External input definitions |
| `derived` | Record | Computed value definitions |
| `async` | Record | Async operation definitions |

### 3.11.1 Key Auto-Prefixing

When defining paths, keys are automatically prefixed based on their container:

| Container | Auto-Prefix | Example |
|-----------|-------------|---------|
| `sources` | `data.` | `items` → `data.items` |
| `derived` | `derived.` | `total` → `derived.total` |
| `async` | `async.` | `rates` → `async.rates` |

Keys with existing correct prefixes are preserved for backward compatibility.

**Example № 14** *Short-form keys with auto-prefixing*

```typescript
{
  sources: {
    items: { ... }           // Stored as 'data.items'
  },
  derived: {
    total: { ... },          // Stored as 'derived.total'
    'derived.legacy': { ... } // Preserved as 'derived.legacy'
  },
  async: {
    rates: { ... }           // Stored as 'async.rates'
  }
}
```

**Note:** Auto-prefixing applies only to definition keys. All other path references (deps, expressions, effects, preconditions) **MUST** use full SemanticPaths.
