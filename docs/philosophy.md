# Philosophy

> **Manifesto is not just a schema-driven UI engine. It is a Semantic UI State Layer that exposes the full meaning, structure, rules, and context of an application's UI—so that both humans and AI Agents can understand, reason about, and interact with the interface.**

This document explains the core philosophy behind Manifesto: why it exists, what makes it fundamentally different from other form libraries, and why it matters for the AI era.

## Table of Contents

- [The Core Identity](#the-core-identity)
- [The Problem](#the-problem)
- [Our Solution: Schema-First](#our-solution-schema-first)
- [AI-Native Context Layer](#ai-native-context-layer)
- [Beyond Form Generation](#beyond-form-generation)
- [Semantic UI Layer](#semantic-ui-layer)
- [Separation of Concerns](#separation-of-concerns)
- [Key Principles](#key-principles)

---

## The Core Identity

Manifesto is often mistaken for "just another form library." It is not.

**What Manifesto is NOT:**
- A form builder like JSONForms or Formily
- A multi-framework abstraction like Uniform
- A low-code platform like Retool
- A validation library like Zod or Yup

**What Manifesto IS:**
- A **Semantic UI State Layer** that models the complete meaning of UI
- A **Context Provider** that exposes UI state to AI agents
- A **Machine-readable Interaction Layer** for application interfaces
- An **AI ↔ Application Interface OS** that bridges human intent and system behavior

The fundamental innovation is not generating UI from schemas—many tools do that. The innovation is **exposing the full semantic context of UI in a structure that AI can understand and reason about**.

### What Traditional Tools Expose

```
┌─────────────────────────────────────────────────────┐
│                  Traditional UI                      │
├─────────────────────────────────────────────────────┤
│  • Rendered HTML/DOM                                │
│  • Visual pixels on screen                          │
│  • Click/input events                               │
└─────────────────────────────────────────────────────┘
        │
        │ AI sees only this
        ▼
    [ Raw pixels / DOM tree ]
    → Hard to understand
    → Impossible to reason about
    → No semantic meaning
```

### What Manifesto Exposes

```
┌─────────────────────────────────────────────────────┐
│                   Manifesto UI                          │
├─────────────────────────────────────────────────────┤
│  Structure  │ Entity/Field/View Schema              │
│  Logic      │ Expression DSL, Reaction DSL          │
│  State      │ Current values, visibility, validity   │
│  Rules      │ Validation, conditional logic          │
│  Context    │ User context, workflow state           │
│  Graph      │ Field dependencies (DAG)              │
│  Transitions│ Valid next states, pending actions     │
└─────────────────────────────────────────────────────┘
        │
        │ AI sees all of this
        ▼
    [ Semantic State Tree ]
    → Fully understandable
    → Reasoning possible
    → Complete meaning exposed
```

This is the fundamental difference. Manifesto doesn't just render UI—it **exports the complete semantic context** that enables AI agents to understand, reason about, and interact with interfaces.

---

## The Problem

### Traditional Form Development

In traditional frontend development, forms are created by writing code:

```tsx
// Traditional approach - logic scattered across code
function ProductForm() {
  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [category, setCategory] = useState('')
  const [showShipping, setShowShipping] = useState(true)

  useEffect(() => {
    // Business logic embedded in component
    if (category === 'DIGITAL') {
      setShowShipping(false)
    }
  }, [category])

  // Validation logic...
  // API calls...
  // More business logic...
}
```

**Problems with this approach:**

1. **High Coupling**: Business logic, UI rendering, and state management are tightly coupled
2. **Duplication**: Similar forms across brands/apps require copy-paste
3. **Maintenance Cost**: Changes require developer intervention
4. **AI Unfriendly**: Code is hard for AI to generate, validate, and modify
5. **No Single Source of Truth**: Rules scattered across files

### The Multi-Brand Challenge

Consider an e-commerce platform with multiple brands:

```
Brand A: Standard product form
Brand B: Same form + extra warranty field
Brand C: Same form + regional tax fields
```

With traditional development:
- Each brand has its own forked codebase
- Common patches require N separate deployments
- Inconsistencies creep in over time
- Maintenance cost grows linearly: O(N)

---

## Our Solution: Schema-First

Manifesto transforms UI from **code** to **data**:

```typescript
// Schema-first approach - declarative definition
const productView = {
  _type: 'view',
  sections: [{
    fields: [
      { id: 'name', component: 'text-input' },
      { id: 'price', component: 'number-input' },
      {
        id: 'shipping',
        component: 'select',
        props: {
          hidden: ['==', '$state.category', 'DIGITAL']  // Declarative condition
        }
      }
    ]
  }]
}
```

**Benefits:**

1. **Single Engine**: One runtime interprets all schemas
2. **Brand Customization**: Different schemas, same engine
3. **O(1) Maintenance**: Fix the engine once, all forms benefit
4. **AI Readable**: Structured data is easy to generate and validate
5. **Single Source of Truth**: All rules in one schema

### Cost Comparison

| Approach | Adding Brand | Bug Fix | Feature Update |
|----------|--------------|---------|----------------|
| Traditional | O(N) - Fork codebase | O(N) - Patch all forks | O(N) - Update all |
| Schema-First | O(1) - New JSON file | O(1) - Fix engine | O(1) - Update engine |

---

## AI-Native Design

Manifesto is designed from the ground up to work with AI:

### Why AI-Native Matters

1. **Generation**: AI can generate valid schemas from natural language
2. **Validation**: Schemas are easily validated against type definitions
3. **Modification**: AI can safely modify schemas without breaking code
4. **Understanding**: Structured data is easier to reason about

### Example: AI Workflow

```
User: "Create a product form with name, price, and category.
       Hide shipping options for digital products."

AI generates:
{
  "sections": [{
    "fields": [
      { "id": "name", "component": "text-input" },
      { "id": "price", "component": "number-input" },
      { "id": "category", "component": "select" },
      {
        "id": "shipping",
        "component": "select",
        "props": {
          "hidden": ["==", "$state.category", "DIGITAL"]
        }
      }
    ]
  }]
}
```

### Safe Expression Evaluation

Unlike arbitrary code, Manifesto expressions are:

- **Whitelisted**: Only approved operators allowed
- **Sandboxed**: No access to global state or functions
- **Validated**: Type-checked before execution
- **Deterministic**: Same input always produces same output

```typescript
// Safe - whitelisted operator
['==', '$state.category', 'DIGITAL']

// Impossible - no eval(), no code injection
'process.exit(1)'  // ❌ Not a valid expression
```

---

## AI-Native Context Layer

This is the revolutionary capability that sets Manifesto apart from every other form library.

### The Problem with Screen-Level AI

Current AI approaches to UI interaction are fundamentally limited:

```
┌─────────────────────────────────────────────────────┐
│            Computer Use / Screen Agents             │
├─────────────────────────────────────────────────────┤
│  1. Capture screenshot                              │
│  2. AI interprets pixels                            │
│  3. AI guesses where to click                       │
│  4. Execute click/type action                       │
│  5. Repeat...                                       │
└─────────────────────────────────────────────────────┘
              │
              │ Problems:
              │ • Expensive (vision model per frame)
              │ • Slow (multiple round trips)
              │ • High failure rate
              │ • No understanding of business logic
              │ • Cannot predict consequences
              ▼
        [ Unreliable Automation ]
```

### The Manifesto Solution: Semantic State Export

Manifesto provides a complete semantic context that AI can consume directly:

```typescript
// What AI receives from Manifesto
const semanticContext = {
  // Current UI Structure
  schema: {
    entity: { /* field definitions, types, constraints */ },
    view: { /* sections, fields, layouts */ },
    actions: { /* available workflows */ }
  },

  // Current State
  state: {
    values: { name: 'Product A', category: 'DIGITAL', price: 99 },
    validity: { name: 'valid', price: 'valid', category: 'valid' },
    visibility: { shipping: false, digitalDelivery: true },
    touched: ['name', 'category'],
    dirty: true
  },

  // Business Rules (evaluated)
  rules: {
    shipping: { hidden: true, reason: "category === 'DIGITAL'" },
    submitButton: { disabled: false, reason: 'form is valid' }
  },

  // Dependency Graph
  dependencies: {
    shipping: ['category'],
    price: [],
    digitalDelivery: ['category']
  },

  // Available Actions
  transitions: {
    submit: { available: true, endpoint: '/api/products' },
    cancel: { available: true, navigateTo: '/products' },
    addVariant: { available: false, reason: 'save first' }
  },

  // Workflow Context
  workflow: {
    currentStep: 'details',
    completedSteps: ['basics'],
    remainingSteps: ['pricing', 'review']
  }
}
```

### What AI Can Do With This Context

With the semantic context, AI agents can:

| Capability | Without Manifesto | With Manifesto |
|------------|----------------|-------------|
| **Understand current state** | Parse DOM/pixels | Read structured state |
| **Know why field is hidden** | Guess | Explicit rule + reason |
| **Predict valid next actions** | Trial and error | Enumerated transitions |
| **Validate before acting** | Submit and see | Pre-check constraints |
| **Navigate workflows** | Observe and mimic | Follow defined steps |
| **Handle edge cases** | Fail unexpectedly | Know all conditions |

### Information Available to AI

| Category | Data Exposed |
|----------|--------------|
| **Field Values** | Current values of all fields |
| **Field Metadata** | Labels, types, placeholders, hints |
| **Visibility State** | Which fields are hidden and why |
| **Disabled State** | Which fields are disabled and why |
| **Validation State** | Errors, warnings, validity per field |
| **Options** | Enumerated choices for selects |
| **Dependencies** | What affects what (DAG) |
| **Pending Actions** | Async operations in progress |
| **Workflow State** | Current step, progress, next steps |
| **User Context** | Role, permissions, preferences |
| **Triggered Reactions** | Events that will fire on changes |

### Why This Matters

LLMs cannot reliably interpret raw HTML/DOM. They hallucinate selectors, miss context, and fail at complex interactions.

But LLMs **can** reason over well-defined semantic state trees:

```
AI receives:          → AI reasons:                → AI acts:

{                       "The shipping field        setValue('category',
  shipping: {           is hidden because          'PHYSICAL')
    hidden: true,       category is DIGITAL.
    rule: "category     To show shipping,          // AI knows this will:
           === DIGITAL" I need to change           // 1. Show shipping field
  }                     category to PHYSICAL"      // 2. Trigger validation
}                                                  // 3. Update form state
```

This is not possible with pixel-level or DOM-level understanding.

---

## Beyond Form Generation

### Manifesto is Not a Form Builder

Many tools generate forms from schemas:

- JSONForms
- Formily
- React Hook Form + Zod
- Retool

But they all share a critical limitation: **the UI's internal semantic context is not exposed externally**.

```
┌─────────────────────────────────────────────────────┐
│           Traditional Schema-Driven UI              │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Schema ──────► Renderer ──────► DOM               │
│                      │                              │
│                      └── Internal state             │
│                          (not accessible)           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Manifesto Exposes Everything

```
┌─────────────────────────────────────────────────────┐
│                   Manifesto Architecture                │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Schema ──────► Engine ──────► DOM                 │
│                    │                                │
│                    ├── State Export ───► AI Agent   │
│                    ├── Rules Export ───► AI Agent   │
│                    ├── Graph Export ───► AI Agent   │
│                    └── Context Export ──► AI Agent  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### The Export Architecture

Manifesto can export:

1. **UI Schema** - Complete structure definition
2. **UI State** - Current values and metadata
3. **Dependency Graph** - Field relationships
4. **Workflow State** - Multi-step progress
5. **Expression Evaluations** - Rule results with reasons
6. **Event Trace** - History of interactions
7. **Action Graph** - Available operations
8. **User Context** - Session and preferences

This makes Manifesto not just a form library, but an **AI ↔ Application interface operating system**.

---

## Semantic UI Layer

Manifesto introduces a **semantic layer** between business requirements and UI implementation:

```
┌─────────────────────────────────────────────────────────┐
│                  Business Requirements                   │
│    "Digital products shouldn't show shipping options"    │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    Semantic Schema                       │
│    { hidden: ['==', '$state.category', 'DIGITAL'] }     │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   UI Implementation                      │
│             React / Vue / Any Framework                  │
└─────────────────────────────────────────────────────────┘
```

### Benefits of Semantic Abstraction

1. **Framework Independence**: Same schema works in React, Vue, or future frameworks
2. **Consistent Behavior**: Business rules apply uniformly across platforms
3. **Human Readable**: Non-developers can understand and review schemas
4. **Machine Processable**: Tools can analyze, validate, and transform schemas

---

## Separation of Concerns

Manifesto enforces a clear 3-layer architecture:

### Entity Layer (What)

Defines **data structure** and **constraints**:

```typescript
// What data exists and its rules
entity('product')
  .field(field.string('name').required().max(100))
  .field(field.number('price').min(0))
  .field(field.enum('category', categories))
```

### View Layer (How)

Defines **UI presentation** and **interactions**:

```typescript
// How data is displayed and edited
view('product-form')
  .section(
    section('basic')
      .field(viewField.textInput('name', 'name'))
      .field(viewField.numberInput('price', 'price'))
  )
```

### Action Layer (When)

Defines **workflows** and **side effects**:

```typescript
// When and how data flows
action('save-product')
  .trigger(trigger.manual())
  .step(api.post('/products').body('$state'))
  .step(navigate('/products'))
```

### Why Separate?

| Layer | Changes When... | Changed By |
|-------|-----------------|------------|
| Entity | Data model changes | Backend/Data team |
| View | UI requirements change | Frontend/UX team |
| Action | Workflow changes | Product/Business team |

Changes to one layer don't affect others. A UI redesign doesn't require touching data validation logic.

---

## Key Principles

### 1. Declarative Over Imperative

```typescript
// ❌ Imperative - how to do it
if (category === 'DIGITAL') {
  shippingField.style.display = 'none'
}

// ✅ Declarative - what to achieve
{ hidden: ['==', '$state.category', 'DIGITAL'] }
```

### 2. Convention Over Configuration

Manifesto provides sensible defaults:

```typescript
// Minimal configuration
viewField.textInput('name', 'name')

// Automatically includes:
// - Label from entity field
// - Validation from constraints
// - Error display
// - Accessibility attributes
```

### 3. Explicit Dependencies

All field dependencies must be declared:

```typescript
viewField.select('city', 'city')
  .dependsOn(['country'])  // Explicit dependency
  .reaction(...)
```

This enables:
- Efficient re-evaluation (only affected fields update)
- Cycle detection (prevent infinite loops)
- Clear data flow visualization

### 4. Type Safety

Every schema element is fully typed:

```typescript
// TypeScript knows this is invalid
const expr: Expression = ['INVALID_OP', 1, 2]  // ❌ Compile error

// TypeScript validates structure
const expr: Expression = ['==', '$state.a', 'b']  // ✅ Valid
```

### 5. Fail-Safe Defaults

Errors degrade gracefully:

```typescript
// If expression fails, field remains visible (safe default)
{ hidden: ['==', '$state.undefined_field', 'value'] }
// Result: hidden = false (field shown)
```

---

## Summary

Manifesto represents a fundamental shift in how we think about UI:

| Traditional | Manifesto |
|-------------|--------|
| UI is code | UI is data |
| Imperative | Declarative |
| Framework-specific | Framework-agnostic |
| Hardcoded | Schema-driven |
| Developer-only | AI-friendly |
| O(N) maintenance | O(1) maintenance |
| **State is internal** | **State is exported** |
| **Opaque to AI** | **Transparent to AI** |

### The Paradigm Shift

Manifesto is not "an advanced form library." It is a new category of technology:

> **Manifesto transforms UI from opaque rendering into a transparent semantic layer that both humans and AI agents can understand, reason about, and interact with.**

The implications are profound:

1. **For Developers**: Write schemas, not code. One source of truth.
2. **For Organizations**: O(1) maintenance cost regardless of scale.
3. **For AI Agents**: Full semantic context for reliable automation.
4. **For the Industry**: A new interface between applications and intelligence.

### Looking Forward

In a world where AI agents increasingly interact with software, the applications that expose semantic context will win. Those that remain opaque—requiring pixel parsing and DOM guessing—will be automated unreliably or not at all.

Manifesto positions applications for the AI era by making UI meaning machine-readable from the start.

This is not just about building forms faster. It's about building software that AI can understand.

---

[Back to Documentation](./README.md)
