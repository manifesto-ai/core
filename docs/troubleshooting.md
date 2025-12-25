# Troubleshooting Guide

This guide helps you diagnose and fix common issues when working with Manifesto.

## Common Errors

### Domain Validation Errors

#### DOMAIN_ID_REQUIRED

**Error**: `Domain id is required`

**Cause**: The `id` field is missing or empty in your domain definition.

**Solution**:
```typescript
const domain = defineDomain({
  id: 'my-domain',  // Required
  name: 'My Domain',
  // ...
});
```

#### DOMAIN_NAME_REQUIRED

**Error**: `Domain name is required`

**Cause**: The `name` field is missing or empty.

**Solution**: Add a descriptive name to your domain definition.

---

### Dependency Errors

#### MISSING_DEPENDENCY

**Error**: `Derived path "derived.x" depends on undefined path "data.y"`

**Cause**: A derived path references a source path that doesn't exist in the domain.

**Solution**:
1. Check that all paths in `deps` array exist in your domain
2. Verify path spelling (paths are case-sensitive)
3. Ensure source paths are defined before derived paths reference them

```typescript
// Wrong - missing source path
paths: {
  sources: {},  // data.count not defined
  derived: {
    'derived.doubled': {
      deps: ['data.count'],  // Error: data.count doesn't exist
      expr: ['*', ['get', 'data.count'], 2],
    }
  }
}

// Correct
paths: {
  sources: {
    'data.count': { schema: z.number(), semantic: { type: 'quantity' } }
  },
  derived: {
    'derived.doubled': {
      deps: ['data.count'],  // Now this works
      expr: ['*', ['get', 'data.count'], 2],
    }
  }
}
```

#### CYCLIC_DEPENDENCY

**Error**: `Cyclic dependency detected: derived.a -> derived.b -> derived.a`

**Cause**: Two or more derived paths depend on each other, creating a cycle.

**Solution**: Restructure your dependencies to break the cycle.

```typescript
// Wrong - cyclic dependency
derived: {
  'derived.a': {
    deps: ['derived.b'],  // a depends on b
    expr: ['get', 'derived.b'],
  },
  'derived.b': {
    deps: ['derived.a'],  // b depends on a (cycle!)
    expr: ['get', 'derived.a'],
  }
}

// Correct - break the cycle
derived: {
  'derived.a': {
    deps: ['data.source'],  // a depends on source
    expr: ['get', 'data.source'],
  },
  'derived.b': {
    deps: ['derived.a'],  // b depends on a (no cycle)
    expr: ['*', ['get', 'derived.a'], 2],
  }
}
```

---

### Action Errors

#### INVALID_PRECONDITION_PATH

**Error**: `Action "submit" has precondition referencing undefined path "state.isValid"`

**Cause**: An action's precondition references a path that doesn't exist.

**Solution**: Ensure all precondition paths are defined in your domain.

#### ACTION_VERB_REQUIRED

**Warning**: `Action "myAction" requires a verb in semantic metadata`

**Cause**: Action is missing semantic verb metadata.

**Solution**:
```typescript
actions: {
  myAction: {
    deps: [],
    effect: ['setValue', 'data.x', 1],
    semantic: {
      verb: 'update',  // Required
      object: 'data',
    }
  }
}
```

---

### Runtime Errors

#### useRuntimeContext must be used within a RuntimeProvider

**Error**: `useRuntimeContext must be used within a RuntimeProvider`

**Cause**: React hooks are being used outside of the provider context.

**Solution**: Wrap your component tree with `RuntimeProvider`:

```tsx
import { RuntimeProvider } from '@manifesto-ai/bridge-react';

function App() {
  return (
    <RuntimeProvider runtime={runtime} domain={domain}>
      <MyComponent />  {/* Now hooks work here */}
    </RuntimeProvider>
  );
}
```

#### Path not found

**Error**: `Cannot get value for path: data.unknown`

**Cause**: Attempting to access a path that doesn't exist in the domain.

**Solution**:
1. Verify the path exists in your domain definition
2. Check for typos in the path string
3. Ensure you're using the correct path prefix (`data.`, `state.`, `derived.`)

---

### Effect Errors

#### HTTP_CLIENT_ERROR / HTTP_SERVER_ERROR

**Cause**: API call received a 4xx or 5xx response.

**Solution**:
1. Check the error's `httpInfo` property for status code and response body
2. Verify API endpoint URL
3. Check authentication/authorization

```typescript
import { isErr, unwrapErr } from '@manifesto-ai/core';

const result = await runtime.executeAction('fetchData');
if (isErr(result)) {
  const error = unwrapErr(result);
  if (error?.code === 'HTTP_CLIENT_ERROR') {
    console.log('Status:', error.cause.httpInfo?.status);
  }
}
```

#### API_CALL_TIMEOUT

**Cause**: API request exceeded the configured timeout.

**Solution**:
1. Increase timeout in effect handler configuration
2. Check for slow network conditions
3. Verify the API endpoint is responding

#### NETWORK_ERROR

**Cause**: Network connectivity issue or CORS error.

**Solution**:
1. Check internet connectivity
2. Verify CORS headers on the API server
3. Check browser console for detailed error

---

## FAQ

### Q: Expression DSL vs JavaScript Functions?

**A**: The Expression DSL (`['*', ['get', 'data.x'], 2]`) is preferred because:
- Expressions are **serializable** (can be sent over network, stored in DB)
- Expressions are **analyzable** (AI can understand and modify them)
- Expressions are **deterministic** (same input = same output)

Use JavaScript functions only when absolutely necessary for complex logic.

### Q: When are Effects executed?

**A**: Effects are **described**, not executed immediately. When you call `runtime.executeAction()`:
1. Preconditions are evaluated
2. Effect description is built
3. Effect runner executes the effect
4. DAG propagation updates dependent values

### Q: Can I use multiple Domains?

**A**: Currently, each runtime instance is bound to a single domain. For multiple domains:
1. Create separate runtime instances
2. Use separate providers in React
3. Coordinate between them via shared state or events

### Q: How do I debug Expression evaluation?

**A**: Use the `evaluate` function with a custom context:

```typescript
import { evaluate } from '@manifesto-ai/core';

const expr = ['*', ['get', 'data.count'], 2];
const context = {
  get: (path) => {
    console.log('Getting:', path);
    return runtime.get(path);
  }
};

const result = evaluate(expr, context);
console.log('Result:', result);
```

### Q: Why isn't my derived value updating?

**A**: Check these common issues:
1. **Missing dependency**: Ensure all paths used in the expression are in the `deps` array
2. **Wrong path**: Verify you're reading from `derived.x`, not `data.x`
3. **Async timing**: For async paths, check loading/error states

```typescript
// Wrong - missing dependency
'derived.total': {
  deps: ['data.price'],  // Missing 'data.quantity'
  expr: ['*', ['get', 'data.price'], ['get', 'data.quantity']],
}

// Correct
'derived.total': {
  deps: ['data.price', 'data.quantity'],
  expr: ['*', ['get', 'data.price'], ['get', 'data.quantity']],
}
```

---

## Getting Help

If you can't find your issue here:

1. Check the [GitHub Issues](https://github.com/manifesto-ai/core/issues)
2. Search existing discussions
3. Open a new issue with:
   - Manifesto version
   - Minimal reproduction code
   - Error message and stack trace
   - Expected vs actual behavior
