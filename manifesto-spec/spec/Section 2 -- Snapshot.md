# Section 2 -- Snapshot

## 2.1 Overview

A **DomainSnapshot** represents the complete state of a domain at a specific point in time. Snapshots are the fundamental data structure in Manifesto, serving as the single source of truth for all domain values.

---

## 2.2 DomainSnapshot Type

### 2.2.1 Type Definition

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

### 2.2.2 Grammar

```
DomainSnapshot :
  data DataValue
  state StateValue
  derived DerivedMap
  validity ValidityMap
  timestamp Timestamp
  version Version

DataValue : unknown

StateValue : unknown

DerivedMap : Record<SemanticPath, unknown>

ValidityMap : Record<SemanticPath, ValidationResult>

Timestamp : number

Version : number
```

---

## 2.3 Field Semantics

### 2.3.1 data

The `data` field contains user input and domain data. Values in this namespace are **writable** through `SetValueEffect`.

A conforming implementation **MUST**:

- Store the `data` field as the first type parameter `TData`
- Preserve the structure defined by the domain's `dataSchema`
- Support nested object and array access

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

### 2.3.2 state

The `state` field contains system and UI state. Values in this namespace are **writable** through `SetStateEffect`.

A conforming implementation **MUST**:

- Store the `state` field as the second type parameter `TState`
- Preserve the structure defined by the domain's `stateSchema`
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

### 2.3.3 derived

The `derived` field contains computed values. Values in this namespace are **read-only** and computed automatically by the runtime.

A conforming implementation **MUST**:

- Store derived values as a `Record<SemanticPath, unknown>`
- Recompute derived values when their dependencies change
- **MUST NOT** allow direct writes to derived paths

**Example № 3** *Derived namespace structure*

```typescript
// Derived values are computed from data/state
// derived.subtotal - sum of item prices
// derived.tax - calculated tax amount
// derived.total - subtotal + tax
// derived.isValid - form validation status
```

> **Note:** Attempting to write to a derived path **MUST** result in a validation error.

### 2.3.4 validity

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

### 2.3.5 timestamp

The `timestamp` field records when the snapshot was created or last modified.

A conforming implementation **MUST**:

- Set `timestamp` to the current time in milliseconds since Unix epoch
- Update `timestamp` when creating new snapshots via modification

### 2.3.6 version

The `version` field tracks the number of modifications to the snapshot.

A conforming implementation **MUST**:

- Initialize `version` to `0` for new snapshots
- Increment `version` by `1` for each modification
- **MUST NOT** decrement or reset `version`

---

## 2.4 Immutability Invariant

Snapshots **MUST** be treated as immutable. Modifications create new snapshot instances.

A conforming implementation **MUST**:

1. Never mutate an existing snapshot in place
2. Create a new snapshot object for each modification
3. Deep clone `data` and `state` when creating modified snapshots
4. Shallow copy `derived` and `validity` maps

> **Note:** The shallow copy for `derived` and `validity` is acceptable because the runtime manages these values and can efficiently recompute them.

---

## 2.5 Snapshot Operations

### 2.5.1 CreateSnapshot

Creates a new snapshot with initial data and state.

```
CreateSnapshot(initialData, initialState):
1. Let {snapshot} be a new DomainSnapshot object.
2. Set {snapshot}.data to {initialData}.
3. Set {snapshot}.state to {initialState}.
4. Set {snapshot}.derived to an empty Record.
5. Set {snapshot}.validity to an empty Record.
6. Set {snapshot}.timestamp to the current time in milliseconds.
7. Set {snapshot}.version to 0.
8. Return {snapshot}.
```

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

### 2.5.2 CloneSnapshot

Creates an immutable copy of a snapshot.

```
CloneSnapshot(snapshot):
1. Let {clone} be a new DomainSnapshot object.
2. Set {clone}.data to a deep clone of {snapshot}.data.
3. Set {clone}.state to a deep clone of {snapshot}.state.
4. Set {clone}.derived to a shallow copy of {snapshot}.derived.
5. Set {clone}.validity to a shallow copy of {snapshot}.validity.
6. Set {clone}.timestamp to {snapshot}.timestamp.
7. Set {clone}.version to {snapshot}.version.
8. Return {clone}.
```

### 2.5.3 GetValueByPath

Retrieves a value from a snapshot using a semantic path.

```
GetValueByPath(snapshot, path):
1. If {path} starts with "data.":
   a. Let {subPath} be {path} with "data." prefix removed.
   b. Return GetNestedValue({snapshot}.data, {subPath}).
2. If {path} starts with "state.":
   a. Let {subPath} be {path} with "state." prefix removed.
   b. Return GetNestedValue({snapshot}.state, {subPath}).
3. If {path} starts with "derived.":
   a. Let {subPath} be {path} with "derived." prefix removed.
   b. If {subPath} exists in {snapshot}.derived:
      i. Return {snapshot}.derived[{subPath}].
   c. If {path} exists in {snapshot}.derived:
      i. Return {snapshot}.derived[{path}].
4. If {path} exists in {snapshot}.derived:
   a. Return {snapshot}.derived[{path}].
5. Return undefined.
```

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

### 2.5.4 SetValueByPath

Creates a new snapshot with a value set at the specified path.

```
SetValueByPath(snapshot, path, value):
1. Let {newSnapshot} be CloneSnapshot({snapshot}).
2. Increment {newSnapshot}.version by 1.
3. Set {newSnapshot}.timestamp to the current time in milliseconds.
4. If {path} starts with "data.":
   a. Let {subPath} be {path} with "data." prefix removed.
   b. Set {newSnapshot}.data to SetNestedValue({newSnapshot}.data, {subPath}, {value}).
   c. Return {newSnapshot}.
5. If {path} starts with "state.":
   a. Let {subPath} be {path} with "state." prefix removed.
   b. Set {newSnapshot}.state to SetNestedValue({newSnapshot}.state, {subPath}, {value}).
   c. Return {newSnapshot}.
6. If {path} starts with "derived.":
   a. Let {subPath} be {path} with "derived." prefix removed.
   b. Set {newSnapshot}.derived[{subPath}] to {value}.
   c. Return {newSnapshot}.
7. Set {newSnapshot}.derived[{path}] to {value}.
8. Return {newSnapshot}.
```

> **Note:** While this algorithm allows setting derived values, the runtime **SHOULD** prevent external writes to derived paths. The algorithm supports derived writes for internal DAG propagation.

### 2.5.5 DiffSnapshots

Computes the paths that changed between two snapshots.

```
DiffSnapshots(oldSnapshot, newSnapshot):
1. Let {changedPaths} be an empty array.
2. Let {dataChanges} be DiffObjects({oldSnapshot}.data, {newSnapshot}.data, "data").
3. Append all {dataChanges} to {changedPaths}.
4. Let {stateChanges} be DiffObjects({oldSnapshot}.state, {newSnapshot}.state, "state").
5. Append all {stateChanges} to {changedPaths}.
6. Let {allDerivedKeys} be the union of keys from {oldSnapshot}.derived and {newSnapshot}.derived.
7. For each {key} in {allDerivedKeys}:
   a. If DeepEqual({oldSnapshot}.derived[{key}], {newSnapshot}.derived[{key}]) is false:
      i. Let {path} be {key} if it starts with "derived.", otherwise "derived." + {key}.
      ii. Append {path} to {changedPaths}.
8. Return {changedPaths}.
```

**Example № 6** *Computing snapshot diff*

```typescript
const oldSnapshot = createSnapshot({ count: 1 }, { loading: false });
const newSnapshot = setValueByPath(oldSnapshot, 'data.count', 2);

diffSnapshots(oldSnapshot, newSnapshot);
// ['data.count']
```

---

## 2.6 Helper Algorithms

### 2.6.1 GetNestedValue

Retrieves a nested value from an object using a dot-separated path.

```
GetNestedValue(obj, path):
1. If {path} is empty, return {obj}.
2. Let {parts} be ParsePath({path}).
3. Let {current} be {obj}.
4. For each {part} in {parts}:
   a. If {current} is null or undefined, return undefined.
   b. Set {current} to {current}[{part}].
5. Return {current}.
```

### 2.6.2 SetNestedValue

Creates a new object with a value set at a nested path.

```
SetNestedValue(obj, path, value):
1. If {path} is empty, return {value}.
2. Let {parts} be ParsePath({path}).
3. Let {result} be a deep clone of {obj}.
4. Let {current} be {result}.
5. For {i} from 0 to length({parts}) - 2:
   a. Let {part} be {parts}[{i}].
   b. If {current}[{part}] is undefined or null:
      i. Set {current}[{part}] to an empty object.
   c. Else:
      i. Set {current}[{part}] to a deep clone of {current}[{part}].
   d. Set {current} to {current}[{part}].
6. Let {lastPart} be {parts}[length({parts}) - 1].
7. Set {current}[{lastPart}] to {value}.
8. Return {result}.
```

### 2.6.3 ParsePath

Parses a path string into segments, supporting both dot notation and bracket notation.

```
ParsePath(path):
1. Let {parts} be an empty array.
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

**Example № 7** *Parsing paths*

```typescript
parsePath('user.name');           // ['user', 'name']
parsePath('items[0].price');      // ['items', '0', 'price']
parsePath('data["complex.key"]'); // ['data', 'complex.key']
```

### 2.6.4 DeepEqual

Performs deep equality comparison between two values.

```
DeepEqual(a, b):
1. If {a} === {b}, return true.
2. If {a} is null or {b} is null, return {a} === {b}.
3. If typeof {a} !== typeof {b}, return false.
4. If typeof {a} !== 'object', return {a} === {b}.
5. If IsArray({a}) and IsArray({b}):
   a. If length({a}) !== length({b}), return false.
   b. For {i} from 0 to length({a}) - 1:
      i. If DeepEqual({a}[{i}], {b}[{i}]) is false, return false.
   c. Return true.
6. If IsArray({a}) or IsArray({b}), return false.
7. Let {aKeys} be the keys of {a}.
8. Let {bKeys} be the keys of {b}.
9. If length({aKeys}) !== length({bKeys}), return false.
10. For each {key} in {aKeys}:
    a. If DeepEqual({a}[{key}], {b}[{key}]) is false, return false.
11. Return true.
```

---

## 2.7 Serialization

### 2.7.1 JSON Serialization

Snapshots **MUST** be serializable to JSON. A conforming implementation:

- **MUST** serialize all primitive types (string, number, boolean, null)
- **MUST** serialize arrays and plain objects
- **SHOULD** handle Date objects by converting to ISO 8601 strings
- **MAY** support custom serialization for other types

**Example № 8** *JSON serialization*

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

### 2.7.2 Deserialization

When deserializing a snapshot:

1. The `timestamp` **SHOULD** be preserved from the serialized form
2. The `version` **SHOULD** be preserved from the serialized form
3. The `derived` values **MAY** be recomputed from the DAG

---

## 2.8 Thread Safety

*Non-normative*

While this specification does not mandate threading models, implementations **SHOULD** consider:

1. Snapshot immutability naturally supports concurrent reads
2. Modifications should be serialized or use compare-and-swap
3. Subscribers should receive consistent snapshots

---

## 2.9 Memory Considerations

*Non-normative*

For large applications:

1. Consider structural sharing between snapshot versions
2. Limit the depth of nested objects
3. Use pagination for large collections in `data`
4. Clean up old snapshots to prevent memory leaks
