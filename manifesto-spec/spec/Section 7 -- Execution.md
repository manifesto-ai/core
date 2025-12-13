# Section 7 -- Execution

## 7.1 Overview

The execution model defines how the runtime processes changes, propagates derived values, and executes effects. Key components include:

1. **Dependency Graph (DAG)**: Tracks relationships between paths
2. **Propagation**: Recomputes derived values when sources change
3. **Effect Execution**: Runs side effects in the correct order
4. **Subscription System**: Notifies listeners of changes

---

## 7.2 Dependency Graph

### 7.2.1 DagNode Types

```typescript
type DagNode = SourceNode | DerivedNode | AsyncNode;

type SourceNode = {
  kind: 'source';
  path: SemanticPath;
  definition: SourceDefinition;
};

type DerivedNode = {
  kind: 'derived';
  path: SemanticPath;
  definition: DerivedDefinition;
};

type AsyncNode = {
  kind: 'async';
  path: SemanticPath;
  definition: AsyncDefinition;
};
```

### 7.2.2 DependencyGraph Type

```typescript
type DependencyGraph = {
  nodes: Map<SemanticPath, DagNode>;
  dependencies: Map<SemanticPath, Set<SemanticPath>>;
  dependents: Map<SemanticPath, Set<SemanticPath>>;
  topologicalOrder: SemanticPath[];
};
```

| Field | Type | Description |
|-------|------|-------------|
| `nodes` | Map | All nodes in the graph |
| `dependencies` | Map | Forward edges: path → what it depends on |
| `dependents` | Map | Reverse edges: path → what depends on it |
| `topologicalOrder` | SemanticPath[] | Sorted for propagation |

---

## 7.3 Graph Construction

### 7.3.1 BuildDependencyGraph

```
BuildDependencyGraph(domain):
1. Let {nodes} be an empty Map.
2. Let {dependencies} be an empty Map.
3. Let {dependents} be an empty Map.

// Add Source nodes
4. For each {path}, {definition} in {domain}.paths.sources:
   a. Add SourceNode({path}, {definition}) to {nodes}.
   b. Set {dependencies}[{path}] to empty Set.
   c. Initialize {dependents}[{path}] if not exists.

// Add Derived nodes
5. For each {path}, {definition} in {domain}.paths.derived:
   a. Add DerivedNode({path}, {definition}) to {nodes}.
   b. Let {deps} be Set from {definition}.deps.
   c. Let {exprDeps} be ExtractPaths({definition}.expr).
   d. For each {dep} in {exprDeps}:
      i. If not starts with "$", add {dep} to {deps}.
   e. Set {dependencies}[{path}] to {deps}.
   f. For each {dep} in {deps}:
      i. Add {path} to {dependents}[{dep}].

// Add Async nodes
6. For each {path}, {definition} in {domain}.paths.async:
   a. Add AsyncNode({path}, {definition}) to {nodes}.
   b. Let {deps} be Set from {definition}.deps.
   c. If {definition}.condition exists:
      i. Add condition dependencies to {deps}.
   d. Set {dependencies}[{path}] to {deps}.
   e. For each {dep} in {deps}:
      i. Add {path} to {dependents}[{dep}].
   f. Register result, loading, error paths.

// Topological sort
7. Let {topologicalOrder} be TopologicalSort({nodes}, {dependencies}).

8. Return { nodes, dependencies, dependents, topologicalOrder }.
```

### 7.3.2 TopologicalSort (Kahn's Algorithm)

```
TopologicalSort(nodes, dependencies):
1. Let {inDegree} be a Map<SemanticPath, number>.
2. For each {path} in {nodes}:
   a. Set {inDegree}[{path}] to 0.
3. For each {path}, {deps} in {dependencies}:
   a. For each {dep} in {deps}:
      i. If {dep} in {nodes}:
         1. Increment {inDegree}[{path}].
4. Let {queue} be paths where {inDegree} = 0.
5. Let {result} be an empty array.
6. While {queue} is not empty:
   a. Dequeue {current} from {queue}.
   b. Append {current} to {result}.
   c. For each {path}, {deps} in {dependencies}:
      i. If {deps} contains {current}:
         1. Decrement {inDegree}[{path}].
         2. If {inDegree}[{path}] = 0:
            a. Enqueue {path}.
7. Return {result}.
```

---

## 7.4 Graph Operations

### 7.4.1 GetDirectDependencies

Returns paths that a given path depends on.

```
GetDirectDependencies(graph, path):
1. Return array from {graph}.dependencies.get({path}) or empty.
```

### 7.4.2 GetDirectDependents

Returns paths that depend on a given path.

```
GetDirectDependents(graph, path):
1. Return array from {graph}.dependents.get({path}) or empty.
```

### 7.4.3 GetAllDependencies (Transitive)

Returns all paths that a path transitively depends on.

```
GetAllDependencies(graph, path):
1. Let {result} be an empty Set.
2. Let {visited} be an empty Set.
3. Define Traverse({current}):
   a. If {current} in {visited}, return.
   b. Add {current} to {visited}.
   c. For each {dep} in {graph}.dependencies.get({current}):
      i. Add {dep} to {result}.
      ii. Call Traverse({dep}).
4. Call Traverse({path}).
5. Return array from {result}.
```

### 7.4.4 GetAllDependents (Transitive)

Returns all paths that transitively depend on a path.

```
GetAllDependents(graph, path):
1. Let {result} be an empty Set.
2. Let {visited} be an empty Set.
3. Define Traverse({current}):
   a. If {current} in {visited}, return.
   b. Add {current} to {visited}.
   c. For each {dep} in {graph}.dependents.get({current}):
      i. Add {dep} to {result}.
      ii. Call Traverse({dep}).
4. Call Traverse({path}).
5. Return array from {result}.
```

### 7.4.5 HasCycle

Detects if the graph contains cycles.

```
HasCycle(graph):
1. Let {visited} be an empty Set.
2. Let {recursionStack} be an empty Set.
3. Define DFS({path}):
   a. Add {path} to {visited}.
   b. Add {path} to {recursionStack}.
   c. For each {dep} in {graph}.dependencies.get({path}):
      i. If {dep} not in {visited}:
         1. If DFS({dep}) is true, return true.
      ii. Else if {dep} in {recursionStack}:
         1. Return true (cycle found).
   d. Remove {path} from {recursionStack}.
   e. Return false.
4. For each {path} in {graph}.nodes:
   a. If {path} not in {visited}:
      i. If DFS({path}) is true, return true.
5. Return false.
```

### 7.4.6 FindPath

Finds a dependency path between two nodes using BFS.

```
FindPath(graph, from, to):
1. If {from} === {to}, return [{from}].
2. Let {visited} be an empty Set.
3. Let {queue} be [{ path: {from}, trail: [{from}] }].
4. While {queue} is not empty:
   a. Dequeue { path, trail }.
   b. If {path} in {visited}, continue.
   c. Add {path} to {visited}.
   d. For each {dep} in {graph}.dependents.get({path}):
      i. If {dep} === {to}, return [...{trail}, {dep}].
      ii. If {dep} not in {visited}:
         1. Enqueue { path: {dep}, trail: [...{trail}, {dep}] }.
5. Return null (no path found).
```

---

## 7.5 Propagation

### 7.5.1 PropagationResult

```typescript
type PropagationResult = {
  changes: Map<SemanticPath, unknown>;
  pendingEffects: Array<{ path: SemanticPath; effect: Effect }>;
  errors: Array<{ path: SemanticPath; error: Error }>;
};
```

### 7.5.2 Propagate Algorithm

When source values change, derived values must be recomputed.

```
Propagate(graph, changedPaths, snapshot):
1. Let {changes} be an empty Map.
2. Let {pendingEffects} be an empty array.
3. Let {errors} be an empty array.
4. Let {affectedOrder} be GetAffectedOrder({graph}, {changedPaths}).
5. Let {context} be CreatePropagationContext({snapshot}, {changes}).

6. For each {path} in {affectedOrder}:
   a. Let {node} be {graph}.nodes.get({path}).
   b. If {node} is null, continue.
   c. Match {node}.kind:

      // Source node
      i. "source":
         1. If {path} in {changedPaths}:
            a. Record in {changes}.

      // Derived node
      ii. "derived":
         1. Try:
            a. Let {value} be Evaluate({node}.definition.expr, {context}).
            b. Let {oldValue} be GetValueByPath({snapshot}, {path}).
            c. If not DeepEqual({value}, {oldValue}):
               - Set {changes}[{path}] to {value}.
         2. Catch {error}:
            a. Append { path: {path}, error: {error} } to {errors}.

      // Async node
      iii. "async":
         1. Let {shouldTrigger} be EvaluateAsyncCondition({node}, {context}).
         2. If {shouldTrigger}:
            a. Set loading state to true.
            b. Append { path: {path}, effect: {node}.definition.effect } to {pendingEffects}.

7. Return { changes: {changes}, pendingEffects: {pendingEffects}, errors: {errors} }.
```

### 7.5.3 GetAffectedOrder

Determines which paths are affected and their evaluation order.

```
GetAffectedOrder(graph, changedPaths):
1. Let {affected} be Set from {changedPaths}.
2. For each {path} in {changedPaths}:
   a. Let {dependents} be GetAllDependents({graph}, {path}).
   b. Add all {dependents} to {affected}.
3. Let {result} be empty array.
4. For each {path} in {graph}.topologicalOrder:
   a. If {path} in {affected}:
      i. Append {path} to {result}.
5. Return {result}.
```

### 7.5.4 CreatePropagationContext

Creates an evaluation context that reads from changes map when available.

```
CreatePropagationContext(snapshot, changes):
1. Return {
     get: (path) => {
       If {changes}.has({path}):
         return {changes}.get({path})
       Else:
         return GetValueByPath({snapshot}, {path})
     }
   }.
```

### 7.5.5 Async Result Path Handling

An Async definition declares three result paths:

| Path | Purpose | Set When |
|------|---------|----------|
| `resultPath` | Stores successful API response | Effect completes successfully |
| `loadingPath` | Indicates loading state | Effect starts / completes |
| `errorPath` | Stores error information | Effect fails |

These paths are **NOT** registered as explicit DAG nodes. They are added only to the `dependencies` and `dependents` maps for tracking purposes.

**Execution Sequence:**

```
HandleAsyncTrigger(asyncNode, handler, context):
1. Set {loadingPath} to true.
2. Clear {errorPath} (set to null).
3. Try:
   a. Let {result} be await RunEffect({asyncNode}.effect, {handler}, {context}).
   b. Set {resultPath} to {result}.
   c. Set {loadingPath} to false.
4. Catch {error}:
   a. Set {errorPath} to {error}.
   b. Set {loadingPath} to false.
```

### 7.5.6 Pending Effects Execution Order

The `pendingEffects` array returned from `Propagate` contains effects triggered by Async nodes whose conditions became true.

**Execution Rules:**

1. Effects **MUST** be executed in array order (sequential by default)
2. An implementation **MAY** provide an option for parallel execution
3. If any effect fails, subsequent effects **MUST NOT** be executed (fail-fast)
4. Each effect execution **MAY** trigger additional propagation cycles

```
ExecutePendingEffects(pendingEffects, config):
1. For each {pending} in {pendingEffects}:
   a. Let {result} be await RunEffect({pending}.effect, {config}).
   b. If {result} is Err:
      i. Return {result}.
2. Return Ok(undefined).
```

---

## 7.6 Effect Execution

### 7.6.1 RunEffect

Executes an effect and returns a Result.

```
RunEffect(effect, config):
1. Let {handler} be {config}.handler.
2. Let {context} be {config}.context.
3. Match {effect}._tag:

   a. "SetValue":
      i. Let {value} be Evaluate({effect}.value, {context}).
      ii. Call {handler}.setValue({effect}.path, {value}).
      iii. Return Ok(undefined).

   b. "SetState":
      i. Let {value} be Evaluate({effect}.value, {context}).
      ii. Call {handler}.setState({effect}.path, {value}).
      iii. Return Ok(undefined).

   c. "ApiCall":
      i. Let {endpoint} be EvaluateIfExpression({effect}.endpoint, {context}).
      ii. Let {body} be EvaluateRecord({effect}.body, {context}).
      iii. Let {query} be EvaluateRecord({effect}.query, {context}).
      iv. Try:
          1. Let {response} be await {handler}.apiCall({endpoint, body, query, ...}).
          2. Return Ok({response}).
      v. Catch {error}:
          1. Return Err(EffectError("API_CALL_FAILED", {error})).

   d. "Navigate":
      i. Let {to} be EvaluateIfExpression({effect}.to, {context}).
      ii. Call {handler}.navigate({to}, {effect}.mode).
      iii. Return Ok(undefined).

   e. "Delay":
      i. Wait {effect}.ms milliseconds.
      ii. Return Ok(undefined).

   f. "Sequence":
      i. Let {lastResult} be Ok(undefined).
      ii. For each {e} in {effect}.effects:
          1. Set {lastResult} to await RunEffect({e}, {config}).
          2. If {lastResult} is Err, return {lastResult}.
      iii. Return {lastResult}.

   g. "Parallel":
      i. Let {promises} be {effect}.effects.map(e => RunEffect(e, config)).
      ii. If {effect}.waitAll:
          1. Let {results} be await Promise.all({promises}).
          2. Return first Err or Ok(all values).
      iii. Else:
          1. Return await Promise.race({promises}).

   h. "Conditional":
      i. Let {condition} be Evaluate({effect}.condition, {context}).
      ii. If {condition} is truthy:
          1. Return await RunEffect({effect}.then, {config}).
      iii. Else if {effect}.else exists:
          1. Return await RunEffect({effect}.else, {config}).
      iv. Return Ok(undefined).

   i. "Catch":
      i. Try:
          1. Let {result} be await RunEffect({effect}.try, {config}).
          2. If {effect}.finally exists:
             a. await RunEffect({effect}.finally, {config}).
          3. Return {result}.
      ii. Catch:
          1. Let {catchResult} be await RunEffect({effect}.catch, {config}).
          2. If {effect}.finally exists:
             a. await RunEffect({effect}.finally, {config}).
          3. Return {catchResult}.

   j. "EmitEvent":
      i. Call {handler}.emitEvent({effect}.channel, {effect}.payload).
      ii. Return Ok(undefined).

4. Return Err(EffectError("UNKNOWN_EFFECT", {effect}._tag)).
```

### 7.6.2 EffectHandler Interface

A conforming implementation **MUST** provide an EffectHandler.

```typescript
type EffectHandler = {
  setValue(path: SemanticPath, value: unknown): void;
  setState(path: SemanticPath, value: unknown): void;
  apiCall(request: ApiRequest): Promise<unknown>;
  navigate(to: string, mode?: 'push' | 'replace'): void;
  emitEvent(channel: string, payload: unknown): void;
};
```

---

## 7.7 DomainRuntime Interface

### 7.7.1 Type Definition

```typescript
interface DomainRuntime<TData, TState> {
  // Snapshot Access
  getSnapshot(): DomainSnapshot<TData, TState>;
  get<T>(path: SemanticPath): T;
  getMany(paths: SemanticPath[]): Record<SemanticPath, unknown>;

  // Mutations
  set(path: SemanticPath, value: unknown): Result<void, ValidationError>;
  setMany(updates: Record<SemanticPath, unknown>): Result<void, ValidationError>;
  execute(actionId: string, input?: unknown): Promise<Result<void, EffectError>>;

  // Policy & Metadata
  getPreconditions(actionId: string): PreconditionStatus[];
  getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy;
  getSemantic(path: SemanticPath): SemanticMeta | undefined;

  // AI Support (Level 3)
  explain(path: SemanticPath): ExplanationTree;
  getImpact(path: SemanticPath): SemanticPath[];

  // Subscription
  subscribe(listener: SnapshotListener): Unsubscribe;
  subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe;
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe;

  // Lifecycle
  dispose(): void;
}
```

### 7.7.2 Method Requirements

#### getSnapshot()

Returns the current immutable snapshot.

**Semantics:**

- **MUST** return the current DomainSnapshot
- **MUST NOT** return a mutated snapshot

#### get(path)

Retrieves a value from the current snapshot.

```
get(path):
1. Let {snapshot} be getSnapshot().
2. Return GetValueByPath({snapshot}, {path}).
```

#### set(path, value)

Sets a value and triggers propagation.

```
set(path, value):
1. Let {validationResult} be ValidateWriteOperation(getSnapshot(), {path}, {value}, domain).
2. If {validationResult}.valid is false:
   a. Return Err({validationResult}.issues[0]).
3. Let {newSnapshot} be SetValueByPath(getSnapshot(), {path}, {value}).
4. Let {propagationResult} be Propagate(graph, [{path}], {newSnapshot}).
5. Apply {propagationResult}.changes to {newSnapshot}.
6. Set current snapshot to {newSnapshot}.
7. Notify subscribers.
8. Execute {propagationResult}.pendingEffects.
9. Return Ok(undefined).
```

#### execute(actionId, input)

Executes a domain action.

```
execute(actionId, input):
1. Let {action} be domain.actions[{actionId}].
2. If {action} is undefined:
   a. Return Err(EffectError("ACTION_NOT_FOUND")).
3. Let {preconditions} be getPreconditions({actionId}).
4. If any precondition is unsatisfied:
   a. Return Err(EffectError("PRECONDITIONS_NOT_MET")).
5. If {action}.input exists and {input} is provided:
   a. Validate {input} against {action}.input schema.
   b. If invalid, return Err(EffectError("INVALID_INPUT")).
6. Let {result} be await RunEffect({action}.effect, config).
7. If {result}.ok:
   a. Propagate changes.
   b. Notify subscribers.
8. Return {result}.
```

---

## 7.8 Subscription System

### 7.8.1 Listener Types

```typescript
type SnapshotListener<TData, TState> = (
  snapshot: DomainSnapshot<TData, TState>,
  changedPaths: SemanticPath[]
) => void;

type PathListener = (value: unknown, path: SemanticPath) => void;

type EventListener = (event: DomainEvent) => void;

type Unsubscribe = () => void;
```

### 7.8.2 DomainEvent Type

```typescript
type DomainEvent = {
  channel: string;
  payload: unknown;
  timestamp: number;
};
```

| Field | Type | Description |
|-------|------|-------------|
| `channel` | string | Event channel (ui, domain, analytics, or custom) |
| `payload` | unknown | Event data |
| `timestamp` | number | Unix timestamp when event was emitted |

### 7.8.3 SubscriptionManager

A conforming Level 3 implementation **SHOULD** provide a SubscriptionManager class.

```typescript
class SubscriptionManager<TData, TState> {
  subscribe(listener: SnapshotListener<TData, TState>): Unsubscribe;
  subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe;
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe;
  notifySnapshotChange(snapshot: DomainSnapshot<TData, TState>, changedPaths: SemanticPath[]): void;
  emitEvent(channel: string, payload: unknown): void;
  clear(): void;
  getSubscriptionCount(): { snapshot: number; path: number; event: number };
}
```

### 7.8.4 Subscription Requirements

A conforming implementation **MUST**:

1. Call snapshot listeners after every snapshot change
2. Call path listeners only when their specific path changes
3. Provide `changedPaths` array to snapshot listeners
4. Return an unsubscribe function
5. Not call listeners after unsubscribe

A conforming Level 3 implementation **SHOULD**:

1. Support wildcard path patterns (e.g., `data.*`)
2. Support a special `*` channel for receiving all events
3. Provide batch notification utilities

### 7.8.5 Wildcard Path Patterns

Wildcard patterns allow subscribing to multiple paths:

| Pattern | Matches |
|---------|---------|
| `data.*` | All direct children of `data` |
| `data.items[*]` | All array elements |
| `data.**` | All descendants (recursive) |

**Example № 1** *Wildcard subscription*

```typescript
// Subscribe to all data changes
runtime.subscribePath('data.*', (value, path) => {
  console.log(`${path} changed to:`, value);
});
```

### 7.8.6 Subscription Algorithm

```
Subscribe(listener):
1. Add {listener} to listeners set.
2. Return function that removes {listener} from set.

NotifySubscribers(newSnapshot, changedPaths):
1. For each {listener} in snapshot listeners:
   a. Call {listener}({newSnapshot}, {changedPaths}).
2. For each {path} in {changedPaths}:
   a. For each {listener} in path listeners for {path}:
      i. Let {value} be GetValueByPath({newSnapshot}, {path}).
      ii. Call {listener}({value}, {path}).
   b. For each {pattern} in wildcard listeners:
      i. If {path} matches {pattern}:
         1. Let {value} be GetValueByPath({newSnapshot}, {path}).
         2. Call matching listeners with ({value}, {path}).
```

### 7.8.7 Batch Notifications

For performance optimization, implementations **MAY** provide batch notification utilities.

```typescript
function createBatchNotifier<TData, TState>(
  manager: SubscriptionManager<TData, TState>,
  debounceMs?: number
): {
  queue(snapshot: DomainSnapshot<TData, TState>, paths: SemanticPath[]): void;
  flush(): void;
};
```

**Semantics:**

- `queue`: Collects changes and schedules notification
- `flush`: Immediately sends all pending notifications
- If `debounceMs` is 0, notifications are immediate
- If `debounceMs` > 0, notifications are debounced

### 7.8.8 ChangedPaths Scope

The `changedPaths` parameter passed to `SnapshotListener` includes:

1. **Direct changes**: Paths explicitly modified by `set` operations
2. **Propagated changes**: All derived paths that were recomputed due to dependency changes

**Example:**

```typescript
// Given domain with:
// - data.price (source)
// - derived.tax = data.price * 0.1
// - derived.total = data.price + derived.tax

runtime.set('data.price', 100);

// SnapshotListener receives:
// changedPaths = ['data.price', 'derived.tax', 'derived.total']
```

A conforming implementation **MUST** include all paths that changed value, regardless of whether the change was direct or propagated.

**Algorithm:**

```
CollectChangedPaths(directChanges, propagationResult):
1. Let {paths} be Set from {directChanges}.
2. For each {path} in {propagationResult}.changes.keys():
   a. Add {path} to {paths}.
3. Return Array.from({paths}).
```

---

## 7.9 Action Preconditions

### 7.9.1 PreconditionEvaluationResult

```typescript
type PreconditionEvaluationResult = {
  condition: ConditionRef;
  actualValue: unknown;
  satisfied: boolean;
  debug?: {
    path: SemanticPath;
    expectedBoolean: boolean;
    actualBoolean: boolean;
  };
};
```

| Field | Type | Description |
|-------|------|-------------|
| `condition` | ConditionRef | The original condition reference |
| `actualValue` | unknown | The actual value at the path |
| `satisfied` | boolean | Whether the condition is satisfied |
| `debug` | object | Optional debug information |

### 7.9.2 ActionAvailability

```typescript
type ActionAvailability = {
  available: boolean;
  unsatisfiedConditions: PreconditionEvaluationResult[];
  reasons: string[];
  explanation: string;
};
```

| Field | Type | Description |
|-------|------|-------------|
| `available` | boolean | Whether the action can be executed |
| `unsatisfiedConditions` | PreconditionEvaluationResult[] | List of failed conditions |
| `reasons` | string[] | Human-readable reasons for unavailability |
| `explanation` | string | AI-friendly detailed explanation |

### 7.9.3 EvaluatePrecondition

Evaluates a single precondition.

```
EvaluatePrecondition(condition, context):
1. Let {actualValue} be {context}.get({condition}.path).
2. Let {actualBoolean} be Boolean({actualValue}).
3. Let {expectedBoolean} be {condition}.expect !== 'false'.
4. Let {satisfied} be {actualBoolean} === {expectedBoolean}.
5. Return {
     condition: {condition},
     actualValue: {actualValue},
     satisfied: {satisfied},
     debug: {
       path: {condition}.path,
       expectedBoolean: {expectedBoolean},
       actualBoolean: {actualBoolean}
     }
   }.
```

### 7.9.4 EvaluateAllPreconditions

```
EvaluateAllPreconditions(conditions, context):
1. Let {results} be an empty array.
2. If {conditions} is undefined or empty, return {results}.
3. For each {cond} in {conditions}:
   a. Append EvaluatePrecondition({cond}, {context}) to {results}.
4. Return {results}.
```

### 7.9.5 CheckActionAvailability

Determines if an action can be executed and provides detailed explanations.

```
CheckActionAvailability(action, context):
1. If {action}.preconditions is undefined or empty:
   a. Return {
        available: true,
        unsatisfiedConditions: [],
        reasons: [],
        explanation: 'Action "{action}.semantic.verb" is available with no preconditions.'
      }.

2. Let {results} be EvaluateAllPreconditions({action}.preconditions, {context}).
3. Let {unsatisfied} be {results}.filter(r => not r.satisfied).

4. If {unsatisfied} is empty:
   a. Return {
        available: true,
        unsatisfiedConditions: [],
        reasons: [],
        explanation: 'Action "{action}.semantic.verb" is available. All preconditions are satisfied.'
      }.

5. Let {reasons} be GenerateReasons({unsatisfied}).
6. Let {explanation} be GenerateExplanation({action}, {unsatisfied}).

7. Return {
     available: false,
     unsatisfiedConditions: {unsatisfied},
     reasons: {reasons},
     explanation: {explanation}
   }.
```

### 7.9.6 GenerateReasons

```
GenerateReasons(unsatisfied):
1. Let {reasons} be an empty array.
2. For each {result} in {unsatisfied}:
   a. If {result}.condition.reason exists:
      i. Append {result}.condition.reason to {reasons}.
   b. Else:
      i. Let {expected} be {result}.condition.expect !== 'false' ? 'true' : 'false'.
      ii. Let {actual} be Boolean({result}.actualValue) ? 'true' : 'false'.
      iii. Append '{result}.condition.path should be {expected}, but is {actual}' to {reasons}.
3. Return {reasons}.
```

### 7.9.7 AI-Friendly Explanations

A conforming Level 3 implementation **SHOULD** generate detailed explanations for AI agents.

**Example № 2** *Action availability explanation*

```
Action "submitOrder" is NOT available.

Unsatisfied preconditions:
  - derived.isFormValid
    Expected: true
    Actual: false (raw: false)
    Reason: All required fields must be filled
  - data.termsAccepted
    Expected: true
    Actual: false (raw: false)

To enable this action:
  - Make derived.isFormValid evaluate to true
  - Make data.termsAccepted evaluate to true
```

### 7.9.8 AnalyzePreconditionRequirements

Returns information needed to satisfy preconditions.

```typescript
function analyzePreconditionRequirements(
  unsatisfied: PreconditionEvaluationResult[]
): Array<{
  path: SemanticPath;
  currentValue: unknown;
  requiredValue: boolean;
  reason?: string;
}>;
```

---

## 7.10 Field Policy Evaluation

### 7.10.1 ConditionEvaluationDetail

```typescript
type ConditionEvaluationDetail = {
  condition: ConditionRef;
  actualValue: unknown;
  satisfied: boolean;
};
```

### 7.10.2 FieldPolicyEvaluation

```typescript
type FieldPolicyEvaluation = {
  relevant: boolean;
  relevantReason?: string;
  relevantConditions?: ConditionEvaluationDetail[];

  editable: boolean;
  editableReason?: string;
  editableConditions?: ConditionEvaluationDetail[];

  required: boolean;
  requiredReason?: string;
  requiredConditions?: ConditionEvaluationDetail[];
};
```

| Field | Type | Description |
|-------|------|-------------|
| `relevant` | boolean | Whether the field should be displayed |
| `relevantReason` | string | Why the field is not relevant |
| `relevantConditions` | ConditionEvaluationDetail[] | Detailed condition results |
| `editable` | boolean | Whether the field can be modified |
| `editableReason` | string | Why the field is not editable |
| `editableConditions` | ConditionEvaluationDetail[] | Detailed condition results |
| `required` | boolean | Whether the field is required |
| `requiredReason` | string | Why the field is required |
| `requiredConditions` | ConditionEvaluationDetail[] | Detailed condition results |

### 7.10.3 FieldUIState

For UI rendering, convert evaluation to UI state.

```typescript
type FieldUIState = {
  visible: boolean;
  enabled: boolean;
  showRequired: boolean;
  disabledReason?: string;
  hiddenReason?: string;
};
```

| Field | Type | Description |
|-------|------|-------------|
| `visible` | boolean | Should the field be rendered |
| `enabled` | boolean | Should the field accept input |
| `showRequired` | boolean | Should show required indicator |
| `disabledReason` | string | Why the field is disabled |
| `hiddenReason` | string | Why the field is hidden |

### 7.10.4 EvaluateFieldPolicy

```
EvaluateFieldPolicy(policy, context):
1. If {policy} is undefined:
   a. Return { relevant: true, editable: true, required: false }.

2. Let {relevantResult} be EvaluateConditionList({policy}.relevantWhen, {context}, true).
3. Let {editableResult} be EvaluateConditionList({policy}.editableWhen, {context}, true).
4. Let {requiredResult} be EvaluateConditionList({policy}.requiredWhen, {context}, false).

5. Return {
     relevant: {relevantResult}.satisfied,
     relevantReason: {relevantResult}.reason,
     relevantConditions: {relevantResult}.details,
     editable: {editableResult}.satisfied,
     editableReason: {editableResult}.reason,
     editableConditions: {editableResult}.details,
     required: {requiredResult}.satisfied,
     requiredReason: {requiredResult}.reason,
     requiredConditions: {requiredResult}.details
   }.
```

### 7.10.5 EvaluateConditionList

```
EvaluateConditionList(conditions, context, defaultValue):
1. If {conditions} is undefined or empty:
   a. Return { satisfied: {defaultValue}, details: [] }.

2. Let {details} be an empty array.
3. Let {firstUnsatisfiedReason} be null.

4. For each {condition} in {conditions}:
   a. Let {actualValue} be {context}.get({condition}.path).
   b. Let {actualBoolean} be Boolean({actualValue}).
   c. Let {expectedBoolean} be {condition}.expect !== 'false'.
   d. Let {satisfied} be {actualBoolean} === {expectedBoolean}.
   e. Append { condition: {condition}, actualValue: {actualValue}, satisfied: {satisfied} } to {details}.
   f. If not {satisfied} and {firstUnsatisfiedReason} is null:
      i. Set {firstUnsatisfiedReason} to {condition}.reason.

5. Let {allSatisfied} be every detail in {details} has satisfied = true.

6. Return {
     satisfied: {allSatisfied},
     reason: {allSatisfied} ? undefined : {firstUnsatisfiedReason},
     details: {details}
   }.
```

### 7.10.6 PolicyToUIState

Converts evaluation result to UI state.

```
PolicyToUIState(evaluation):
1. Return {
     visible: {evaluation}.relevant,
     enabled: {evaluation}.relevant AND {evaluation}.editable,
     showRequired: {evaluation}.relevant AND {evaluation}.required,
     disabledReason: {evaluation}.editable ? undefined : {evaluation}.editableReason,
     hiddenReason: {evaluation}.relevant ? undefined : {evaluation}.relevantReason
   }.
```

### 7.10.7 EvaluateMultipleFieldPolicies

Batch evaluation for multiple fields.

```typescript
function evaluateMultipleFieldPolicies(
  policies: Record<SemanticPath, FieldPolicy | undefined>,
  context: EvaluationContext
): Record<SemanticPath, FieldPolicyEvaluation>;
```

### 7.10.8 ExplainFieldPolicy

Generates AI-friendly explanation of a field's policy state.

```typescript
function explainFieldPolicy(
  path: SemanticPath,
  evaluation: FieldPolicyEvaluation
): string;
```

**Example № 3** *Field policy explanation*

```
Field: data.shippingAddress

Relevant: No
  Reason: Pickup option selected
  - state.deliveryMethod: expected delivery, got pickup

Editable: Yes

Required: No
```

### 7.10.9 ExtractFieldPolicyDependencies

Returns all paths that a field policy depends on.

```typescript
function extractFieldPolicyDependencies(policy: FieldPolicy): SemanticPath[];
```

This is useful for determining which state changes affect field visibility.

---

## 7.11 AI Support Features (Level 3)

### 7.11.1 ExplanationTree

For AI agents, the runtime can explain why a value is what it is.

```typescript
type ExplanationTree = {
  path: SemanticPath;
  value: unknown;
  kind: 'source' | 'derived' | 'async';
  expression?: string;
  dependencies: ExplanationTree[];
};
```

### 7.11.2 explain(path)

Builds an explanation tree for a path.

```
Explain(path):
1. Let {node} be graph.nodes.get({path}).
2. If {node} is undefined, return null.
3. Let {value} be get({path}).
4. Let {deps} be GetDirectDependencies(graph, {path}).
5. Let {dependencies} be {deps}.map(d => Explain(d)).
6. Return {
     path: {path},
     value: {value},
     kind: {node}.kind,
     expression: {node}.definition.expr (if derived),
     dependencies: {dependencies}
   }.
```

### 7.11.3 getImpact(path)

Returns paths that would be affected if this path changes.

```
GetImpact(path):
1. Return GetAllDependents(graph, {path}).
```

### 7.11.4 Cycle Prevention in Explanation Trees

The `explain` function **MUST** prevent infinite recursion from circular dependencies.

**Strategies (implementations MAY choose one):**

1. **Visited Set**: Track already-visited paths and return empty dependencies for revisited paths
2. **Depth Limit**: Enforce maximum recursion depth (recommended: 10)
3. **Hybrid**: Use both visited tracking and depth limit

**Recommended Implementation:**

```
ExplainWithCyclePrevention(path, visited, maxDepth):
1. If {maxDepth} <= 0, return { path, value: get(path), kind: 'truncated', dependencies: [] }.
2. If {path} in {visited}, return { path, value: get(path), kind: 'cycle', dependencies: [] }.
3. Add {path} to {visited}.
4. Let {node} be graph.nodes.get({path}).
5. If {node} is undefined, return null.
6. Let {deps} be GetDirectDependencies(graph, {path}).
7. Let {dependencies} be {deps}.map(d => ExplainWithCyclePrevention(d, {visited}, {maxDepth} - 1)).
8. Return {
     path: {path},
     value: get({path}),
     kind: {node}.kind,
     expression: {node}.definition.expr (if derived),
     dependencies: {dependencies}.filter(d => d !== null)
   }.
```

**Error Indicators:**

| `kind` Value | Meaning |
|--------------|---------|
| `'truncated'` | Max depth reached |
| `'cycle'` | Circular reference detected |

---

## 7.12 Error Handling

### 7.12.1 Error Types

```typescript
type RuntimeError =
  | ValidationError
  | EffectError
  | PropagationError;

type ValidationError = {
  kind: 'validation';
  issues: ValidationIssue[];
};

type EffectError = {
  kind: 'effect';
  code: string;
  message: string;
  cause?: unknown;
};

type PropagationError = {
  kind: 'propagation';
  path: SemanticPath;
  error: Error;
};
```

### 7.12.2 Error Recovery

A conforming implementation **SHOULD**:

1. Not leave the snapshot in an inconsistent state
2. Roll back changes on propagation errors
3. Provide detailed error information
4. Allow retry for retryable errors

---

## 7.13 Lifecycle

### 7.13.1 dispose()

Cleans up runtime resources.

```
dispose():
1. Remove all listeners.
2. Cancel pending async effects.
3. Clear internal state.
4. Mark runtime as disposed.
```

A conforming implementation **MUST** prevent operations after dispose.
