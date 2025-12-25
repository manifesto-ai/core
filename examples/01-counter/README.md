# Counter Example

A minimal counter application demonstrating Manifesto's core concepts.

## Features

This example showcases:

- **Source Paths**: `data.count` for storing the counter value
- **Derived Paths**: `derived.doubled`, `derived.isPositive`, etc.
- **State Paths**: `state.step` for configurable step size
- **React Hooks**: `useValue`, `useSetValue`, `useDerived`

## Quick Start

```bash
# From the repository root
cd examples/01-counter
pnpm install
pnpm dev
```

Then open http://localhost:5173 in your browser.

## Project Structure

```
01-counter/
├── src/
│   ├── domain.ts    # Manifesto domain definition
│   ├── App.tsx      # React components
│   └── main.tsx     # Entry point with runtime setup
├── package.json
├── vite.config.ts
└── README.md
```

## Key Concepts

### Domain Definition

The `counterDomain` defines:

```typescript
// Source path - raw data
'data.count': { schema: z.number(), ... }

// Derived path - computed value
'derived.doubled': {
  deps: ['data.count'],
  expr: ['*', ['get', 'data.count'], 2],
}

// Actions
actions: {
  increment: {
    deps: ['data.count', 'state.step'],
    effect: ['setValue', 'data.count', ['+', ['get', 'data.count'], ['get', 'state.step']]],
  },
}
```

### React Integration

```tsx
function Counter() {
  // Subscribe to path value
  const { value: count } = useValue<number>('data.count');

  // Get setter function
  const { setValue } = useSetValue();

  // Access derived value
  const { value: doubled } = useDerived<number>('derived.doubled');

  return (
    <button onClick={() => setValue('data.count', count + 1)}>
      Count: {count} (doubled: {doubled})
    </button>
  );
}
```

## Learn More

- [Getting Started Guide](../../docs/getting-started.md)
- [Concepts Overview](../../docs/concepts.md)
- [API Reference](../../docs/api/)
