# Section 2 -- Snapshot

## 2.1 Overview

A **DomainSnapshot** represents the complete state of a domain at a specific point in time. Snapshots are the fundamental data structure in Manifesto, serving as the single source of truth for all domain values.

---

# Part A: Normative Requirements

---

## 2.2 DomainSnapshot Type

### 2.2.1 Language-Neutral Definition

A DomainSnapshot is a structured value containing six fields:

| Field | Type | Writability | Description |
|-------|------|-------------|-------------|
| `data` | Domain-defined | Writable | User input and domain data conforming to the domain's data schema |
| `state` | Domain-defined | Writable | System and UI state conforming to the domain's state schema |
| `derived` | Mapping | Read-only | A mapping from SemanticPath to computed values |
| `validity` | Mapping | Read-only | A mapping from SemanticPath to ValidationResult |
| `timestamp` | Integer | System-managed | Milliseconds since Unix epoch (1970-01-01T00:00:00Z) |
| `version` | Non-negative integer | System-managed | Modification counter, monotonically increasing |

### 2.2.2 TypeScript Reference

*The following type definition serves as a reference implementation in TypeScript. Implementations in other languages should provide equivalent semantics.*

```typescript
type DomainSnapshot<TData = unknown, TState = unknown> = {
  data: TData;
  state: TState;
  derived: Record<SemanticPath, unknown>;
  validity: Record<SemanticPath, ValidationResult>;
  timestamp: number;
  version: number;
};
```

### 2.2.3 Grammar

```
DomainSnapshot :
  data DataValue
  state StateValue
  derived DerivedMap
  validity ValidityMap
  timestamp Timestamp
  version Version

DataValue : domain-defined structured value

StateValue : domain-defined structured value

DerivedMap : mapping from SemanticPath to any value

ValidityMap : mapping from SemanticPath to ValidationResult

Timestamp : non-negative integer (milliseconds since epoch)

Version : non-negative integer
```

---

## 2.3 Semantic Guarantees

### 2.3.1 Field Semantics

#### data

The `data` field contains user input and domain data. Values in this namespace are **writable** through `SetValueEffect`.

A conforming implementation **MUST**:

- Provide access to values via paths starting with `data.`
- Preserve the shape and values as defined by the domain's `dataSchema`
- Support hierarchical access via SemanticPath, including indexed collection access

**Example № 1** *Data namespace structure*

```typescript
// Domain data type
type OrderData = {
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  customer: {
    email: string;
    name: string;
  };
  couponCode: string | null;
};

// Accessible via paths:
// data.items[0].productId
// data.customer.email
// data.couponCode
```

#### state

The `state` field contains system and UI state. Values in this namespace are **writable** through `SetStateEffect`.

A conforming implementation **MUST**:

- Provide access to values via paths starting with `state.`
- Preserve the shape and values as defined by the domain's `stateSchema`
- Support async operation state (loading, error, result)

**Example № 2** *State namespace structure*

```typescript
// Domain state type
type OrderState = {
  isLoading: boolean;
  error: string | null;
  currentStep: 'cart' | 'shipping' | 'payment' | 'confirmation';
  shippingOptions: ShippingOption[] | null;
};

// Accessible via paths:
// state.isLoading
// state.error
// state.currentStep
// state.shippingOptions
```

#### derived

The `derived` field contains computed values. Values in this namespace are **read-only** and computed automatically by the runtime.

A conforming implementation **MUST**:

- Provide access to values via paths starting with `derived.` or by direct key lookup
- Recompute derived values when their dependencies change
- **MUST NOT** allow external writes to derived paths

**Example № 3** *Derived namespace structure*

```typescript
// Derived values are computed from data/state
// derived.subtotal - sum of item prices
// derived.tax - calculated tax amount
// derived.total - subtotal + tax
// derived.isValid - form validation status
```

> **Note:** Attempting to write to a derived path from external code **MUST** result in a validation error.

#### validity

The `validity` field contains validation results for paths. This namespace is **read-only** and populated by the validation system.

```typescript
type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

type ValidationIssue = {
  code: string;
  message: string;
  path: SemanticPath;
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  suggestedFix?: {
    description: string;
    value: Expression;
  };
};
```

### 2.3.2 Namespace Access Control

A conforming implementation **MUST** enforce the following access rules:

| Namespace | External Read | External Write | Runtime Write |
|-----------|---------------|----------------|---------------|
| `data` | Allowed | Via SetValueEffect | Allowed |
| `state` | Allowed | Via SetStateEffect | Allowed |
| `derived` | Allowed | **Prohibited** | Allowed (DAG propagation) |
| `validity` | Allowed | **Prohibited** | Allowed (validation system) |

### 2.3.3 Immutability Invariant

Snapshots **MUST** exhibit immutable behavior from the perspective of any code that holds a reference to a snapshot.

**Behavioral Requirements:**

A conforming implementation **MUST** ensure:

1. **Value Stability**: Once a snapshot is created and made observable, any subsequent read of its fields **MUST** return values structurally equivalent to the original values.

2. **Isolation**: A modification operation (such as SetValueByPath) **MUST** return a new snapshot such that:
   - The original snapshot remains observationally unchanged
   - Modifications to the new snapshot **MUST NOT** affect the original
   - Modifications to the original snapshot (if somehow possible) **MUST NOT** affect the new snapshot

3. **Identity Distinction**: The new snapshot **MUST** be distinguishable from the original (i.e., they **MUST NOT** be the same reference).

**Implementation Freedom:**

Implementations **MAY** use any technique that satisfies these behavioral requirements, including but not limited to:

- Eager deep copying
- Structural sharing (copy-on-write)
- Persistent data structures
- Immutable data structure libraries
- Lazy cloning with copy-on-write semantics

> **Note:** See Appendix 2.B for implementation strategies.

### 2.3.4 Version Semantics

The `version` field provides a monotonically increasing counter for snapshot lineage.

**Invariants:**

1. **Initial Value**: `version` **MUST** equal `0` for snapshots created via CreateSnapshot.

2. **Monotonic Increase**: For any snapshot `S'` derived from `S` via a modification operation:
   - `S'.version` **MUST** be greater than `S.version`
   - `S'.version` **MUST** equal `S.version + 1`

3. **Non-Decreasing**: There **MUST NOT** exist any operation that decreases `version`.

4. **No Reset**: There **MUST NOT** exist any operation that resets `version` to a previous value within the same domain lineage.

**Rationale:** Version monotonicity enables optimistic concurrency control, change detection, and causal ordering of modifications.

### 2.3.5 Timestamp Semantics

The `timestamp` field records the wall-clock time of snapshot creation or modification.

**Invariants:**

1. **Unit**: Timestamp **MUST** be expressed in milliseconds since Unix epoch (1970-01-01T00:00:00Z).

2. **Non-Decreasing**: For any snapshot `S'` derived from `S`:
   - `S'.timestamp` **MUST** be greater than or equal to `S.timestamp`

3. **Currency**: The timestamp **SHOULD** reflect the actual time of the modification operation.

**Implementation Note:** Due to clock skew and resolution limitations, implementations **MAY** observe `S'.timestamp === S.timestamp` for rapid successive modifications.

### 2.3.6 Copy-on-Write Semantics

To clarify the relationship between snapshot immutability (Section 2.3.3) and modification operations:

**Behavioral Model:**

Snapshot immutability is achieved via **copy-on-write** semantics:

1. **All mutation operations return NEW snapshots**: Operations like `SetValueByPath` **MUST** return a new snapshot instance rather than modifying the input snapshot.

2. **Internal propagation creates new snapshots**: When the DAG propagation system computes derived values, each intermediate state **MUST** be represented by a new snapshot (or an efficient equivalent such as structural sharing).

3. **Original snapshots remain unchanged**: Any code holding a reference to a snapshot can rely on its values remaining stable.

4. **Version comparison for identity**: Callers **MUST NOT** assume snapshot reference identity. Use `version` comparison to detect changes.

**Example № 8.1** *Copy-on-write behavior*

```typescript
const s0 = createSnapshot({ count: 0 }, {});
const s1 = setValueByPath(s0, 'data.count', 1);

// s0 is unchanged
s0.data.count;  // 0
s0.version;     // 0

// s1 is a new snapshot
s1.data.count;  // 1
s1.version;     // 1

// Reference identity differs
s0 === s1;      // false
```

**Propagation Context:**

During DAG propagation (Section 7.5), the runtime internally creates a sequence of snapshots:

```
S0 (input) → S1 (derived.a computed) → S2 (derived.b computed) → S3 (final)
```

Each step produces a new snapshot. The runtime **MAY** optimize this via structural sharing, but **MUST** ensure the final snapshot returned to callers satisfies all immutability guarantees.

---

## 2.4 Observable Behaviors

This section defines the observable behaviors that constitute the snapshot API. Each operation is specified in terms of its inputs, outputs, and post-conditions.

### 2.4.1 CreateSnapshot

Creates a new snapshot with initial data and state.

**Signature:**

```
CreateSnapshot(initialData, initialState) -> DomainSnapshot
```

**Behavioral Contract:**

Given `snapshot = CreateSnapshot(initialData, initialState)`:

1. **Field Initialization**:
   - `snapshot.data` **MUST** be structurally equivalent to `initialData`
   - `snapshot.state` **MUST** be structurally equivalent to `initialState`
   - `snapshot.derived` **MUST** be an empty mapping
   - `snapshot.validity` **MUST** be an empty mapping

2. **Metadata Initialization**:
   - `snapshot.version` **MUST** equal `0`
   - `snapshot.timestamp` **MUST** be the current time in milliseconds since Unix epoch

**Example № 4** *Creating a snapshot*

```typescript
const snapshot = createSnapshot(
  { count: 0, items: [] },  // initial data
  { loading: false }         // initial state
);

// Result:
// {
//   data: { count: 0, items: [] },
//   state: { loading: false },
//   derived: {},
//   validity: {},
//   timestamp: 1702500000000,
//   version: 0
// }
```

### 2.4.2 GetValueByPath

Retrieves a value from a snapshot using a semantic path.

**Signature:**

```
GetValueByPath(snapshot, path) -> value | undefined
```

**Behavioral Contract:**

1. **Namespace Routing**: The path **MUST** be resolved according to its namespace prefix:
   - Paths starting with `data.` resolve against `snapshot.data`
   - Paths starting with `state.` resolve against `snapshot.state`
   - Paths starting with `derived.` resolve against `snapshot.derived`
   - Other paths **SHOULD** be checked against `snapshot.derived`

2. **Path Traversal**: The implementation **MUST** traverse nested structures according to SemanticPath semantics (Section 3).

3. **Missing Values**: If the path cannot be resolved, the function **MUST** return an absent value (e.g., `undefined` in JavaScript, `None` in Python, `nil` in other languages).

4. **Determinism**: Given identical inputs, the function **MUST** return identical outputs.

**Example № 5** *Getting values by path*

```typescript
const snapshot = createSnapshot(
  { user: { name: 'Alice', age: 30 } },
  { loading: false }
);

getValueByPath(snapshot, 'data.user.name');  // 'Alice'
getValueByPath(snapshot, 'data.user.age');   // 30
getValueByPath(snapshot, 'state.loading');   // false
getValueByPath(snapshot, 'data.missing');    // undefined
```

### 2.4.3 SetValueByPath

Creates a new snapshot with a value set at the specified path.

**Signature:**

```
SetValueByPath(snapshot, path, value) -> DomainSnapshot
```

**Behavioral Contract:**

Given `result = SetValueByPath(snapshot, path, value)`:

1. **New Snapshot**: `result` **MUST** be a new snapshot distinct from `snapshot`.

2. **Value Set**: `GetValueByPath(result, path)` **MUST** be structurally equivalent to `value`.

3. **Version Increment**: `result.version` **MUST** equal `snapshot.version + 1`.

4. **Timestamp Update**: `result.timestamp` **MUST** be greater than or equal to `snapshot.timestamp`.

5. **Unmodified Paths**: For all paths `p` where `p` is neither `path` nor a sub-path or parent-path of `path`:
   - `GetValueByPath(result, p)` **MUST** be structurally equivalent to `GetValueByPath(snapshot, p)`

6. **Original Unchanged**: The input `snapshot` **MUST** remain observationally unchanged (per Section 2.3.3).

> **Note:** While this specification allows setting derived values for internal DAG propagation, external writes to derived paths **SHOULD** be prevented by the runtime.

### 2.4.4 CloneSnapshot

Creates a snapshot that is an independent copy of the input snapshot.

**Signature:**

```
CloneSnapshot(snapshot) -> DomainSnapshot
```

**Behavioral Contract:**

Given `clone = CloneSnapshot(snapshot)`:

1. **Value Equivalence**: For all valid paths `p`:
   - `GetValueByPath(clone, p)` **MUST** be structurally equivalent to `GetValueByPath(snapshot, p)`

2. **Metadata Preservation**:
   - `clone.timestamp` **MUST** equal `snapshot.timestamp`
   - `clone.version` **MUST** equal `snapshot.version`

3. **Independence**: Subsequent modifications to `clone` via SetValueByPath **MUST NOT** affect `snapshot`, and vice versa.

4. **Identity Distinction**: `clone` **MUST NOT** be the same reference as `snapshot`.

**Implementation Notes:**

Implementations **MAY** achieve this contract through:
- Eager deep cloning
- Lazy cloning with copy-on-write
- Structural sharing where unmodified subtrees share references
- Any other technique preserving the behavioral contract

> **Reference Implementation:** See Appendix 2.A.1 for a sample implementation.

### 2.4.5 DiffSnapshots

Computes the paths that changed between two snapshots.

**Signature:**

```
DiffSnapshots(oldSnapshot, newSnapshot) -> SemanticPath[]
```

**Behavioral Contract:**

1. **Completeness**: All paths where values differ **MUST** be included in the result.

2. **Soundness**: All paths in the result **MUST** have structurally different values between the two snapshots.

3. **Namespace Coverage**: The diff **MUST** consider `data`, `state`, and `derived` namespaces.

4. **Structural Comparison**: Value comparison **MUST** use structural equality semantics.

**Example № 6** *Computing snapshot diff*

```typescript
const oldSnapshot = createSnapshot({ count: 1 }, { loading: false });
const newSnapshot = setValueByPath(oldSnapshot, 'data.count', 2);

diffSnapshots(oldSnapshot, newSnapshot);
// ['data.count']
```

---

## 2.5 Serialization Requirements

### 2.5.1 JSON Serialization

Snapshots **MUST** be serializable to JSON. A conforming implementation:

- **MUST** serialize all primitive types (string, number, boolean, null)
- **MUST** serialize indexed collections and mappings
- **SHOULD** handle Date values by converting to ISO 8601 strings
- **MAY** support custom serialization for other types

**Example № 7** *JSON serialization*

```typescript
const snapshot = createSnapshot(
  { count: 42, name: 'test' },
  { active: true }
);

const json = JSON.stringify(snapshot);
// {
//   "data": { "count": 42, "name": "test" },
//   "state": { "active": true },
//   "derived": {},
//   "validity": {},
//   "timestamp": 1702500000000,
//   "version": 0
// }
```

### 2.5.2 Deserialization

When deserializing a snapshot:

1. The `timestamp` **SHOULD** be preserved from the serialized form.
2. The `version` **SHOULD** be preserved from the serialized form.
3. The `derived` values **MAY** be recomputed from the DAG instead of being deserialized.

---

## 2.6 Conformance Levels

### Level 1: Minimal Conformance

A Level 1 implementation **MUST**:

- Implement the DomainSnapshot structure with all six fields
- Satisfy all **MUST** requirements in Section 2.3 (Semantic Guarantees)
- Implement CreateSnapshot, GetValueByPath, and SetValueByPath per Section 2.4
- Support JSON serialization per Section 2.5

### Level 2: Standard Conformance

A Level 2 implementation **MUST** satisfy Level 1 and additionally:

- Implement CloneSnapshot per Section 2.4.4
- Implement DiffSnapshots per Section 2.4.5
- Support all SemanticPath syntax defined in Section 3

### Level 3: Full Conformance

A Level 3 implementation **MUST** satisfy Level 2 and additionally:

- Provide builder functions for snapshot operations
- Support validation results in the `validity` namespace
- Implement thread-safe snapshot access (if applicable to the runtime environment)

---

# Part B: Non-Normative (Informative)

---

## Appendix 2.A Reference Implementations

*This appendix is non-normative. It provides reference implementations for guidance. Implementations are free to use alternative techniques that achieve the same behavioral guarantees.*

### 2.A.1 Snapshot Cloning

The following algorithm provides one approach to cloning snapshot data using deep copying. Implementations **MAY** use structural sharing, persistent data structures, or other techniques.

```
CloneSnapshot(snapshot):
1. Let {clone} be a new DomainSnapshot.
2. Set {clone}.data to DeepClone({snapshot}.data).
3. Set {clone}.state to DeepClone({snapshot}.state).
4. Set {clone}.derived to ShallowCopy({snapshot}.derived).
5. Set {clone}.validity to ShallowCopy({snapshot}.validity).
6. Set {clone}.timestamp to {snapshot}.timestamp.
7. Set {clone}.version to {snapshot}.version.
8. Return {clone}.
```

> **Note:** The shallow copy for `derived` and `validity` is one valid approach because the runtime manages these values and can efficiently recompute them.

### 2.A.2 Deep Clone

```
DeepClone(value):
1. If {value} is null or not an object type, return {value}.
2. If {value} is an indexed collection:
   a. Return a new collection where each element is DeepClone of the original.
3. If {value} is a mapping:
   a. Let {result} be a new empty mapping.
   b. For each key-value pair in {value}:
      i. Set {result}[key] to DeepClone(value).
   c. Return {result}.
4. Return {value}.
```

### 2.A.3 Path Parsing

Parses a path string into segments, supporting both dot notation and bracket notation.

```
ParsePath(path):
1. Let {parts} be an empty sequence.
2. Let {current} be an empty string.
3. Let {inBracket} be false.
4. Let {bracketContent} be an empty string.
5. For each {char} in {path}:
   a. If {char} is '[' and {inBracket} is false:
      i. If {current} is not empty, append {current} to {parts} and reset {current}.
      ii. Set {inBracket} to true.
   b. Else if {char} is ']' and {inBracket} is true:
      i. Let {cleaned} be {bracketContent} with leading/trailing quotes removed.
      ii. Append {cleaned} to {parts}.
      iii. Reset {bracketContent} and set {inBracket} to false.
   c. Else if {char} is '.' and {inBracket} is false:
      i. If {current} is not empty, append {current} to {parts} and reset {current}.
   d. Else if {inBracket} is true:
      i. Append {char} to {bracketContent}.
   e. Else:
      i. Append {char} to {current}.
6. If {current} is not empty, append {current} to {parts}.
7. Return {parts}.
```

**Example № 8** *Parsing paths*

```typescript
parsePath('user.name');           // ['user', 'name']
parsePath('items[0].price');      // ['items', '0', 'price']
parsePath('data["complex.key"]'); // ['data', 'complex.key']
```

### 2.A.4 Nested Value Access

```
GetNestedValue(obj, path):
1. If {path} is empty, return {obj}.
2. Let {parts} be ParsePath({path}).
3. Let {current} be {obj}.
4. For each {part} in {parts}:
   a. If {current} is null or absent, return absent.
   b. Set {current} to {current}[{part}].
5. Return {current}.
```

### 2.A.5 Nested Value Setting

```
SetNestedValue(obj, path, value):
1. If {path} is empty, return {value}.
2. Let {parts} be ParsePath({path}).
3. Let {result} be a clone of {obj}.
4. Let {current} be {result}.
5. For {i} from 0 to length({parts}) - 2:
   a. Let {part} be {parts}[{i}].
   b. If {current}[{part}] is absent:
      i. Set {current}[{part}] to an empty mapping.
   c. Else:
      i. Set {current}[{part}] to a clone of {current}[{part}].
   d. Set {current} to {current}[{part}].
6. Let {lastPart} be {parts}[length({parts}) - 1].
7. Set {current}[{lastPart}] to {value}.
8. Return {result}.
```

### 2.A.6 Structural Equality

```
StructuralEqual(a, b):
1. If {a} and {b} are the same reference, return true.
2. If {a} is null or {b} is null, return {a} === {b}.
3. If types of {a} and {b} differ, return false.
4. If {a} is not a composite type, return {a} === {b}.
5. If {a} and {b} are indexed collections:
   a. If lengths differ, return false.
   b. For each index {i}:
      i. If StructuralEqual({a}[{i}], {b}[{i}]) is false, return false.
   c. Return true.
6. If {a} and {b} are mappings:
   a. If key counts differ, return false.
   b. For each key in {a}:
      i. If StructuralEqual({a}[key], {b}[key]) is false, return false.
   c. Return true.
7. Return false.
```

---

## Appendix 2.B Implementation Strategies

*This appendix is non-normative.*

### 2.B.1 Structural Sharing

Structural sharing allows efficient snapshot modification by sharing unmodified subtrees between snapshots.

```typescript
// Conceptual example - only clone the modified path
function setNestedValueWithSharing(obj, path, value) {
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  return {
    ...obj,  // shallow copy - shares unmodified branches
    [head]: setNestedValueWithSharing(obj[head], tail, value)
  };
}
```

**Trade-offs:**

- **Pro**: O(depth) memory per modification vs O(n) for deep clone
- **Pro**: Enables efficient equality checks via reference equality for unchanged subtrees
- **Con**: Requires careful handling of nested modifications
- **Con**: May retain references to old data, affecting garbage collection

### 2.B.2 Persistent Data Structures

Libraries providing immutable/persistent data structures can be used:

- **JavaScript/TypeScript**: Immutable.js, Immer
- **Clojure**: Native persistent data structures
- **Scala**: scala.collection.immutable
- **Rust**: im-rs, rpds

**Example with Immer:**

```typescript
import { produce } from 'immer';

function setValueByPath(snapshot, path, value) {
  return produce(snapshot, draft => {
    setNested(draft, path, value);
    draft.version++;
    draft.timestamp = Date.now();
  });
}
```

### 2.B.3 Lazy Evaluation

For large derived value maps, lazy evaluation can defer computation:

```typescript
// Conceptual - derived values computed on first access
class LazyDerived {
  private cache = new Map();

  get(key) {
    if (!this.cache.has(key)) {
      this.cache.set(key, this.compute(key));
    }
    return this.cache.get(key);
  }
}
```

### 2.B.4 Thread Safety Considerations

For concurrent environments:

1. Snapshot immutability naturally supports concurrent reads without synchronization.
2. Modification operations should be serialized or use atomic compare-and-swap.
3. Consider read-copy-update (RCU) patterns for high-read workloads.
4. Subscribers should receive consistent snapshots.

### 2.B.5 Memory Optimization

For memory-constrained environments:

1. Limit snapshot history retention.
2. Use weak references for derived value caches.
3. Consider compression for serialized snapshots.
4. Implement snapshot pooling for high-frequency modifications.

---

## Appendix 2.C Test Vectors

*This appendix is normative for conformance testing.*

### Test Vector 1: Modification Isolation

**Given:**

```json
{
  "data": { "count": 1 },
  "state": {},
  "derived": {},
  "validity": {},
  "timestamp": 1000,
  "version": 0
}
```

**After** `SetValueByPath(snapshot, "data.count", 2)`:

| Assertion | Expected |
|-----------|----------|
| Original `snapshot.data.count` | `1` (unchanged) |
| Original `snapshot.version` | `0` (unchanged) |
| New `result.data.count` | `2` |
| New `result.version` | `1` |

### Test Vector 2: Version Monotonicity

**Given** sequential modifications S0 -> S1 -> S2 -> S3:

| Snapshot | Version |
|----------|---------|
| S0 (initial) | `0` |
| S1 | `1` |
| S2 | `2` |
| S3 | `3` |

Each version **MUST** increment by exactly 1.

### Test Vector 3: Clone Independence

**Given:**

```
S0 = CreateSnapshot({ x: 1 }, {})
S1 = CloneSnapshot(S0)
S2 = SetValueByPath(S1, "data.x", 42)
```

| Assertion | Expected |
|-----------|----------|
| `GetValueByPath(S0, "data.x")` | `1` |
| `GetValueByPath(S1, "data.x")` | `1` |
| `GetValueByPath(S2, "data.x")` | `42` |
| `S0.version` | `0` |
| `S1.version` | `0` |
| `S2.version` | `1` |

### Test Vector 4: Timestamp Non-Decreasing

**Given:**

```
S0 = CreateSnapshot({}, {}) at time T0
S1 = SetValueByPath(S0, "data.x", 1) at time T1
```

| Assertion | Expected |
|-----------|----------|
| `S1.timestamp >= S0.timestamp` | `true` |

### Test Vector 5: Structural Equality for DiffSnapshots

**Given:**

```
S0 = CreateSnapshot({ a: [1, 2, 3], b: { c: 1 } }, {})
S1 = SetValueByPath(S0, "data.a[1]", 99)
```

| Assertion | Expected |
|-----------|----------|
| `DiffSnapshots(S0, S1)` contains `"data.a[1]"` or `"data.a"` | `true` |
| `DiffSnapshots(S0, S1)` contains `"data.b"` | `false` |
