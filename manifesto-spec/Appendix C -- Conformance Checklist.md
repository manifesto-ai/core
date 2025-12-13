# Appendix C -- Conformance Checklist

This appendix provides a checklist for implementations to verify conformance with this specification. Implementations **SHOULD** complete all items in their target conformance level.

---

## C.1 Conformance Levels Overview

| Level | Name | Description |
|-------|------|-------------|
| 1 | Core | Minimum viable implementation |
| 2 | Standard | Full expression and effect support |
| 3 | Full | Complete feature set with AI support |

Each level includes all requirements from previous levels.

---

## C.2 Level 1: Core Conformance

### C.2.1 DomainSnapshot

- [ ] Implement `DomainSnapshot` type with all required fields
- [ ] `data` field holds domain data (unknown type)
- [ ] `state` field holds UI/ephemeral state (unknown type)
- [ ] `derived` field is `Record<SemanticPath, unknown>`
- [ ] `validity` field is `Record<SemanticPath, ValidationResult>`
- [ ] `timestamp` field is a number (Unix milliseconds)
- [ ] `version` field is an integer (monotonically increasing)

### C.2.2 SemanticPath

- [ ] Parse paths with namespace prefix (`data.`, `state.`, `derived.`, `actions.`)
- [ ] Support dot-notation property access (`data.user.name`)
- [ ] Support bracket notation for array indices (`data.items[0]`)
- [ ] Support bracket notation for string keys (`data.users["john@example.com"]`)
- [ ] Reject invalid path syntax with appropriate errors

### C.2.3 Basic Expressions

- [ ] Literal expressions: string, number, boolean, null
- [ ] `get` expression: retrieve values from snapshot
- [ ] Comparison: `==`, `!=`, `>`, `>=`, `<`, `<=`
- [ ] Logical: `!` (not), `all`, `any`
- [ ] Handle null values without errors

### C.2.4 Core Effects

- [ ] `SetValueEffect`: write to data paths
- [ ] `SetStateEffect`: write to state paths
- [ ] Effects include required `description` field
- [ ] Return `Result<T, E>` from effect execution
- [ ] Validate path before writing
- [ ] Reject writes to derived paths

### C.2.5 Basic Validation

- [ ] Validate domain definition structure
- [ ] Check for missing required fields
- [ ] Return `ValidationResult` with issues array
- [ ] Include error code, message, path, and severity

---

## C.3 Level 2: Standard Conformance

### C.3.1 Complete Expression DSL

**Arithmetic:**
- [ ] `+` (addition)
- [ ] `-` (subtraction)
- [ ] `*` (multiplication)
- [ ] `/` (division)
- [ ] `%` (modulo)

**String Functions:**
- [ ] `concat` - concatenate strings
- [ ] `upper` - uppercase
- [ ] `lower` - lowercase
- [ ] `trim` - remove whitespace
- [ ] `slice` - substring
- [ ] `split` - split string into array
- [ ] `join` - join array into string
- [ ] `matches` - regex matching
- [ ] `replace` - string replacement

**Array Functions:**
- [ ] `length` - array/string length
- [ ] `at` - element at index
- [ ] `first` - first element
- [ ] `last` - last element
- [ ] `includes` - containment check
- [ ] `indexOf` - find index
- [ ] `map` - transform elements
- [ ] `filter` - filter elements
- [ ] `every` - all match predicate
- [ ] `some` - any matches predicate
- [ ] `reduce` - fold to single value
- [ ] `flatten` - flatten nested arrays
- [ ] `unique` - remove duplicates
- [ ] `sort` - sort elements
- [ ] `reverse` - reverse order

**Number Functions:**
- [ ] `sum` - sum of array
- [ ] `min` - minimum value
- [ ] `max` - maximum value
- [ ] `avg` - average value
- [ ] `count` - count elements
- [ ] `round` - round to precision
- [ ] `floor` - round down
- [ ] `ceil` - round up
- [ ] `abs` - absolute value
- [ ] `clamp` - clamp to range

**Object Functions:**
- [ ] `has` - key existence check
- [ ] `keys` - get object keys
- [ ] `values` - get object values
- [ ] `entries` - get key-value pairs
- [ ] `pick` - select keys
- [ ] `omit` - exclude keys

**Type Functions:**
- [ ] `isNull` - null check
- [ ] `isNumber` - number check
- [ ] `isString` - string check
- [ ] `isArray` - array check
- [ ] `isObject` - object check
- [ ] `toNumber` - convert to number
- [ ] `toString` - convert to string

**Conditional:**
- [ ] `case` - conditional branching
- [ ] `match` - pattern matching
- [ ] `coalesce` - null coalescing

**Date Functions:**
- [ ] `now` - current timestamp
- [ ] `date` - parse date
- [ ] `year` - extract year
- [ ] `month` - extract month
- [ ] `day` - extract day
- [ ] `diff` - date difference

### C.3.2 Complete Effect Types

- [ ] `ApiCallEffect` - HTTP requests with method, headers, body, query, timeout
- [ ] `NavigateEffect` - navigation with push/replace modes
- [ ] `DelayEffect` - time delays in milliseconds
- [ ] `SequenceEffect` - sequential execution
- [ ] `ParallelEffect` - parallel execution with waitAll option
- [ ] `ConditionalEffect` - conditional execution with then/else
- [ ] `CatchEffect` - error handling with try/catch/finally
- [ ] `EmitEventEffect` - event emission on ui/domain/analytics channels

### C.3.3 DAG Propagation

- [ ] Build dependency graph from domain definition
- [ ] Detect cyclic dependencies during domain validation
- [ ] Compute topological order for evaluation
- [ ] Propagate changes through derived paths
- [ ] Track dirty nodes for incremental updates
- [ ] Handle async node execution

### C.3.4 Domain Validation

- [ ] Validate domain id and name are present
- [ ] Check all dependency references exist
- [ ] Detect cyclic dependencies in derived paths
- [ ] Validate action precondition paths exist
- [ ] Warn on missing semantic metadata
- [ ] Return all issues (not just first error)

### C.3.5 Schema Validation

- [ ] Integrate with Zod schemas
- [ ] Validate values before writing to paths
- [ ] Map Zod errors to ValidationIssue format
- [ ] Support custom validation codes

---

## C.4 Level 3: Full Conformance

### C.4.1 Subscription System

- [ ] `PathListener` type: `(value: unknown, path: SemanticPath) => void`
- [ ] Subscribe to specific paths
- [ ] Subscribe to path patterns with wildcards (`data.*`, `data.items[*]`)
- [ ] `DomainEvent` type with channel, payload, timestamp
- [ ] Event channel subscriptions (ui, domain, analytics)
- [ ] `SubscriptionManager` class for managing subscriptions
- [ ] Batch notifications to reduce update frequency
- [ ] Unsubscribe functionality with cleanup

### C.4.2 Precondition Evaluation

- [ ] `PreconditionStatus` type with path, expect, actual, satisfied, reason
- [ ] `PreconditionEvaluationResult` with condition, satisfied, actualValue, reason
- [ ] `ActionAvailability` with available, unsatisfiedConditions, reasons, explanation
- [ ] Evaluate preconditions before action execution
- [ ] Generate human-readable explanations for unavailable actions
- [ ] Provide AI-friendly availability explanations

### C.4.3 Field Policy Evaluation

- [ ] `ResolvedFieldPolicy` with individual reason fields
- [ ] `FieldUIState` with visible, enabled, required, validationMessage
- [ ] Evaluate `relevantWhen` conditions
- [ ] Evaluate `editableWhen` conditions
- [ ] Evaluate `requiredWhen` conditions
- [ ] Convert policy to UI state
- [ ] Batch evaluate multiple field policies
- [ ] Generate policy explanations

### C.4.4 Effect Builder Functions

- [ ] `setValue(path, value, description)` - create SetValueEffect
- [ ] `setState(path, value, description)` - create SetStateEffect
- [ ] `apiCall(options)` - create ApiCallEffect
- [ ] `navigate(to, mode, description)` - create NavigateEffect
- [ ] `delay(ms, description)` - create DelayEffect
- [ ] `sequence(effects, description)` - create SequenceEffect
- [ ] `parallel(effects, waitAll, description)` - create ParallelEffect
- [ ] `conditional(condition, then, else, description)` - create ConditionalEffect
- [ ] `catchEffect(try, catch, finally, description)` - create CatchEffect
- [ ] `emitEvent(channel, payload, description)` - create EmitEventEffect

### C.4.5 Result Utilities

**Constructors:**
- [ ] `ok(value)` - create success result
- [ ] `err(error)` - create error result

**Type Guards:**
- [ ] `isOk(result)` - check if success
- [ ] `isErr(result)` - check if error

**Extractors:**
- [ ] `unwrap(result)` - extract value or throw
- [ ] `unwrapOr(result, defaultValue)` - extract value or use default
- [ ] `unwrapErr(result)` - extract error or throw

**Transformers:**
- [ ] `map(result, fn)` - transform success value
- [ ] `mapErr(result, fn)` - transform error value
- [ ] `flatMap(result, fn)` - chain result-returning functions
- [ ] `flatten(result)` - flatten nested results

**Combinators:**
- [ ] `all(results)` - combine array of results (fail on first error)
- [ ] `any(results)` - take first success

**Async Support:**
- [ ] `fromPromise(promise)` - convert promise to result
- [ ] `tryCatch(fn)` - wrap throwing function

### C.4.6 AI Support Features

- [ ] Semantic metadata on all path definitions
- [ ] `explain()` function for human-readable state descriptions
- [ ] `getImpact()` function for action impact analysis
- [ ] AI-friendly error messages
- [ ] Domain-level AI description in meta

---

## C.5 Testing Recommendations

### C.5.1 Unit Tests

Implementations **SHOULD** include tests for:

1. **Path Parsing**: Valid/invalid path syntax
2. **Expression Evaluation**: Each operator with edge cases
3. **Effect Execution**: Success and error scenarios
4. **Validation**: All validation codes
5. **DAG Propagation**: Dependency chain updates

### C.5.2 Integration Tests

1. **End-to-End Workflows**: Action → Effect → Propagation → Subscription
2. **Error Recovery**: CatchEffect handling
3. **Concurrent Updates**: ParallelEffect coordination
4. **Schema Validation**: Zod integration

### C.5.3 Conformance Test Suite

A reference conformance test suite is available at:
- `packages/core/src/__tests__/`

Implementations **MAY** use this suite to verify conformance.

---

## C.6 Reporting Conformance

When claiming conformance, implementations **SHOULD** specify:

1. **Conformance Level**: 1, 2, or 3
2. **Version**: Specification version (e.g., 1.0.0)
3. **Deviations**: Any intentional deviations from the specification
4. **Extensions**: Additional features beyond the specification

**Example Conformance Statement:**

```
This implementation conforms to Manifesto Core Specification v1.0.0
at Level 2 (Standard Conformance) with the following notes:
- Level 3 subscription system partially implemented (no wildcards)
- Extension: Custom "Log" effect type for debugging
```

---

## C.7 Version Compatibility

### C.7.1 Backward Compatibility

Implementations at higher specification versions **SHOULD**:

1. Accept domain definitions from lower versions
2. Emit deprecation warnings for obsolete features
3. Provide migration guidance when breaking changes occur

### C.7.2 Forward Compatibility

Implementations **SHOULD** gracefully handle:

1. Unknown effect types (log warning, skip execution)
2. Unknown expression operators (return error result)
3. Unknown metadata fields (ignore, preserve on serialization)
