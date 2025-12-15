# Version Migration

This document guides the changes needed when upgrading `@manifesto-ai/core` package versions.

## Current Version

```bash
npm info @manifesto-ai/core version
# 0.2.0
```

---

## Version History

### v0.2.0 (Current)

**Key Features**
- Complete domain definition system (`defineDomain`, `defineSource`, `defineDerived`, `defineAsync`, `defineAction`)
- Expression DSL (JSON-based declarative expressions)
- Effect system (side effect descriptions)
- Result pattern (functional error handling)
- DAG-based change propagation
- Policy system (preconditions, field policies)
- Zod integrated schema validation
- Runtime API (`createRuntime`, snapshots, subscriptions)

**Dependencies**
- `zod`: ^3.24.1

### v0.1.0

**Initial Release**
- Basic domain definition
- Expression evaluation
- Simple runtime

---

## Migration Guide

### v0.1.x → v0.2.x

#### Breaking Changes

##### 1. deps Field Required in defineDerived

```typescript
// v0.1.x (deprecated)
const total = defineDerived({
  expr: ['+', ['get', 'derived.subtotal'], ['get', 'derived.shippingFee']]
});

// v0.2.x (required)
const total = defineDerived({
  deps: ['derived.subtotal', 'derived.shippingFee'],  // Required
  expr: ['+', ['get', 'derived.subtotal'], ['get', 'derived.shippingFee']]
});
```

**Reason**: Explicit dependency declaration makes DAG construction more accurate and enables build-time detection of circular dependencies.

##### 2. SemanticMeta Type Changes

```typescript
// v0.1.x
type SemanticMeta = {
  type: string;
  description?: string;
  editable?: boolean;
};

// v0.2.x
type SemanticMeta = {
  type: string;
  description: string;  // Required
  importance?: 'critical' | 'high' | 'medium' | 'low';
  readable?: boolean;
  writable?: boolean;   // Renamed from editable
  examples?: unknown[];
  hints?: Record<string, unknown>;
};
```

**Migration**:
```typescript
// v0.1.x
defineSource({
  schema: z.string(),
  semantic: { type: 'string', editable: true }
});

// v0.2.x
defineSource({
  schema: z.string(),
  semantic: {
    type: 'string',
    description: 'Description required',  // Added
    writable: true                         // editable → writable
  }
});
```

##### 3. Effect Type Changes

```typescript
// v0.1.x
type Effect = {
  kind: 'setValue' | 'apiCall' | ...;
  // ...
};

// v0.2.x
type Effect = {
  type: 'SetValue' | 'ApiCall' | ...;  // kind → type, PascalCase
  // ...
};
```

**Migration**:
```typescript
// v0.1.x
const effect = { kind: 'setValue', path: 'data.items', value: [] };

// v0.2.x
const effect = { type: 'SetValue', path: 'data.items', value: [] };

// Or use builder functions (recommended)
import { setValue } from '@manifesto-ai/core';
const effect = setValue('data.items', []);
```

##### 4. Runtime API Changes

```typescript
// v0.1.x
const runtime = createRuntime(domain, initialData);
runtime.getValue('data.items');
runtime.setValue('data.items', [...]);

// v0.2.x
const runtime = createRuntime({ domain, initialData, initialState });
runtime.get('data.items');
runtime.set('data.items', [...]);
```

**Migration**:
```typescript
// v0.1.x
const runtime = createRuntime(orderDomain, { items: [] });
const items = runtime.getValue('data.items');

// v0.2.x
const runtime = createRuntime({
  domain: orderDomain,
  initialData: { items: [] },
  initialState: { isSubmitting: false }
});
const items = runtime.get('data.items');
```

##### 5. Validation Result Type Changes

```typescript
// v0.1.x
type ValidationError = {
  field: string;
  message: string;
};

// v0.2.x
type ValidationIssue = {
  code: string;
  message: string;
  path: SemanticPath;
  severity: 'error' | 'warning' | 'suggestion';
  suggestedFix?: { description: string; value: unknown };
};
```

---

## Future Version Plans

### v0.3.0 (Planned)

**Planned Features**
- `defineTaskFlow` - Multi-step task definition
- Bridge package separation (`@manifesto-ai/react`, `@manifesto-ai/vue`)
- Projection package (`@manifesto-ai/projection-agent`)

**Expected Breaking Changes**
- `createRuntime` return type may change from interface to class
- Effect execution method may change

### v1.0.0 (Planned)

**Stabilization**
- API freeze
- Performance optimization
- Complete type inference

---

## Version Compatibility Table

| Core Version | React Bridge | Vue Bridge | Zod |
|--------------|--------------|------------|-----|
| 0.2.x | 0.2.x | 0.2.x | ^3.24.0 |
| 0.1.x | 0.1.x | - | ^3.22.0 |

---

## Migration Checklist

### v0.1.x → v0.2.x Upgrade

- [ ] Add `deps` array to `defineDerived`
- [ ] Change `SemanticMeta`'s `editable` → `writable`
- [ ] Add required `description` to `SemanticMeta`
- [ ] Change Effect's `kind` → `type` (or use builder functions)
- [ ] Change `createRuntime` call to object form
- [ ] Change `getValue`/`setValue` → `get`/`set`
- [ ] Update validation error handling logic

---

## Auto-Migration Tool

### codemod (Planned)

An automatic migration tool will be provided in future versions.

```bash
# Planned
npx @manifesto-ai/codemod upgrade 0.2
```

---

## Compatibility Layer

### v0.1.x Compatible API (Deprecated)

Some old APIs continue to work with warnings.

```typescript
// Internally outputs warning then calls new API
import { createRuntime } from '@manifesto-ai/core/compat';

// Usage is the same but console shows deprecation warning
const runtime = createRuntime(domain, data);
// Warning: createRuntime(domain, data) is deprecated.
// Use createRuntime({ domain, initialData }) instead.
```

**Note**: The compatibility layer will be removed in v1.0.0.

---

## Troubleshooting

### Common Migration Issues

#### 1. TypeScript Type Errors

```
Type 'string' is not assignable to type 'SemanticPath'
```

**Solution**: SemanticPath is now a branded type. Use string literals or type assertions.

```typescript
// Method 1: Infer as literal type
const path = 'data.items' as const;

// Method 2: Type assertion
const path = 'data.items' as SemanticPath;
```

#### 2. Missing deps Warning

```
Warning: Expression references paths not listed in deps: ['derived.subtotal']
```

**Solution**: Add all referenced paths to `defineDerived`'s `deps` array.

```typescript
defineDerived({
  deps: ['derived.subtotal', 'derived.discount'],  // Add missing paths
  expr: ['+', ['get', 'derived.subtotal'], ['get', 'derived.discount']]
});
```

#### 3. Circular Dependency Error

```
Error: Circular dependency detected: derived.a → derived.b → derived.a
```

**Solution**: Redesign the dependency structure.

```typescript
// Wrong example
const a = defineDerived({
  deps: ['derived.b'],
  expr: ['get', 'derived.b']
});

const b = defineDerived({
  deps: ['derived.a'],  // Circular!
  expr: ['get', 'derived.a']
});

// Correct example: Derive from common source
const a = defineDerived({
  deps: ['data.value'],
  expr: ['*', ['get', 'data.value'], 2]
});

const b = defineDerived({
  deps: ['data.value'],
  expr: ['*', ['get', 'data.value'], 3]
});
```

---

## Support

### Issue Reporting

Create a GitHub issue if you encounter problems during migration.

- [GitHub Issues](https://github.com/manifesto-ai/core/issues)

### Labels

- `migration` - Migration related issues
- `breaking-change` - Breaking change related
- `help wanted` - Community help requested

---

## Next Steps

- [Overview](01-overview.md) - Check latest architecture
- [Domain Definition](03-domain-definition.md) - Learn new APIs
- [Runtime API](07-runtime.md) - Changed runtime API
