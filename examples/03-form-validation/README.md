# Form Validation Example

A registration form demonstrating validation patterns with Manifesto.

## Features

- **Field-level validation**: Each field has its own derived validation paths
- **Form-level validation**: Combined validation of all fields
- **Real-time feedback**: Instant validation as user types
- **Error messages**: Descriptive error messages via derived paths

## Quick Start

```bash
cd examples/03-form-validation
pnpm install
pnpm dev
```

## Key Concepts

### Validation via Derived Paths

Each field has validation derived paths:

```typescript
// Email validation
'derived.emailValid': {
  deps: ['data.email'],
  expr: ['match', ['get', 'data.email'], '^[^@]+@[^@]+\\.[^@]+$'],
}

// Email error message
'derived.emailError': {
  deps: ['data.email', 'derived.emailValid'],
  expr: [
    'if',
    ['==', ['get', 'data.email'], ''],
    'Email is required',
    ['if', ['get', 'derived.emailValid'], '', 'Invalid email format'],
  ],
}
```

### Form-level Validation

Combine all field validations:

```typescript
'derived.formValid': {
  deps: ['derived.emailValid', 'derived.passwordValid', ...],
  expr: [
    'and',
    ['get', 'derived.emailValid'],
    ['get', 'derived.passwordValid'],
    // ...
  ],
}
```

### Action Preconditions

Submit action requires form to be valid:

```typescript
actions: {
  submit: {
    preconditions: [
      { path: 'derived.formValid', expect: 'true', reason: 'Form must be valid' }
    ],
    effect: ['setValue', 'state.submitted', true],
  }
}
```

## Project Structure

```
03-form-validation/
├── src/
│   ├── domain.ts    # Form domain with validation
│   ├── App.tsx      # Form components
│   └── main.tsx     # Entry point
└── ...
```

## Learn More

- [01-counter](../01-counter) - Basic concepts
- [02-todo-list](../02-todo-list) - CRUD patterns
- [04-async-data](../04-async-data) - Async operations
