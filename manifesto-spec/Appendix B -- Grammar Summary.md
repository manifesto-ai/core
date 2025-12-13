# Appendix B -- Grammar Summary

This appendix provides a complete summary of all grammar rules defined in this specification, organized alphabetically.

---

## B.1 Lexical Grammar

### Primitives

```
Boolean : "true" | "false"

Digit : [0-9]

Identifier : IdentifierStart IdentifierContinue*

IdentifierContinue : [a-zA-Z0-9_]

IdentifierStart : [a-zA-Z_]

Integer : Digit+

Null : "null"

Number : Integer ("." Integer)?

String : "\"" StringCharacter* "\"" | "'" StringCharacter* "'"

StringCharacter : ~["'\\] | "\\" EscapeSequence

EscapeSequence : "\"" | "'" | "\\" | "n" | "r" | "t"
```

---

## B.2 SemanticPath Grammar

```
SemanticPath : NamespacePrefix PathSegments?

NamespacePrefix : Namespace "."

Namespace : "data" | "state" | "derived" | "actions"

PathSegments : PathSegment ("." PathSegment)*

PathSegment : Identifier | IndexAccess | StringKeyAccess

IndexAccess : "[" Integer "]"

StringKeyAccess : "[" String "]"
```

---

## B.3 DomainSnapshot Grammar

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

Timestamp : Number

Version : Integer
```

---

## B.4 Expression Grammar

### Top-Level

```
Expression :
  LiteralExpr |
  GetExpr |
  OperatorExpr |
  FunctionExpr

LiteralExpr : String | Number | Boolean | Null

GetExpr : ["get", SemanticPath]

OperatorExpr : ComparisonExpr | LogicalExpr | ArithmeticExpr

FunctionExpr : ConditionalExpr | StringFn | ArrayFn | NumberFn | ObjectFn | TypeFn | DateFn
```

### Comparison Expressions

```
ComparisonExpr : EqExpr | NeqExpr | GtExpr | GteExpr | LtExpr | LteExpr

EqExpr : ["==", Expression, Expression]

NeqExpr : ["!=", Expression, Expression]

GtExpr : [">", Expression, Expression]

GteExpr : [">=", Expression, Expression]

LtExpr : ["<", Expression, Expression]

LteExpr : ["<=", Expression, Expression]
```

### Logical Expressions

```
LogicalExpr : NotExpr | AllExpr | AnyExpr

NotExpr : ["!", Expression]

AllExpr : ["all", Expression+]

AnyExpr : ["any", Expression+]
```

### Arithmetic Expressions

```
ArithmeticExpr : AddExpr | SubExpr | MulExpr | DivExpr | ModExpr

AddExpr : ["+", Expression, Expression]

SubExpr : ["-", Expression, Expression]

MulExpr : ["*", Expression, Expression]

DivExpr : ["/", Expression, Expression]

ModExpr : ["%", Expression, Expression]
```

### Conditional Expressions

```
ConditionalExpr : CaseExpr | MatchExpr | CoalesceExpr

CaseExpr : ["case", CaseClause+, Expression]

CaseClause : [Expression, Expression]

MatchExpr : ["match", Expression, MatchClause+, Expression]

MatchClause : [Expression, Expression]

CoalesceExpr : ["coalesce", Expression+]
```

### String Functions

```
StringFn :
  ConcatExpr |
  UpperExpr |
  LowerExpr |
  TrimExpr |
  SliceExpr |
  SplitExpr |
  JoinExpr |
  MatchesExpr |
  ReplaceExpr

ConcatExpr : ["concat", Expression+]

UpperExpr : ["upper", Expression]

LowerExpr : ["lower", Expression]

TrimExpr : ["trim", Expression]

SliceExpr : ["slice", Expression, Number, Number?]

SplitExpr : ["split", Expression, String]

JoinExpr : ["join", Expression, String]

MatchesExpr : ["matches", Expression, String]

ReplaceExpr : ["replace", Expression, String, String]
```

### Array Functions

```
ArrayFn :
  LengthExpr |
  AtExpr |
  FirstExpr |
  LastExpr |
  IncludesExpr |
  IndexOfExpr |
  MapExpr |
  FilterExpr |
  EveryExpr |
  SomeExpr |
  ReduceExpr |
  FlattenExpr |
  UniqueExpr |
  SortExpr |
  ReverseExpr

LengthExpr : ["length", Expression]

AtExpr : ["at", Expression, Number]

FirstExpr : ["first", Expression]

LastExpr : ["last", Expression]

IncludesExpr : ["includes", Expression, Expression]

IndexOfExpr : ["indexOf", Expression, Expression]

MapExpr : ["map", Expression, Expression]

FilterExpr : ["filter", Expression, Expression]

EveryExpr : ["every", Expression, Expression]

SomeExpr : ["some", Expression, Expression]

ReduceExpr : ["reduce", Expression, Expression, Expression]

FlattenExpr : ["flatten", Expression]

UniqueExpr : ["unique", Expression]

SortExpr : ["sort", Expression, Expression?]

ReverseExpr : ["reverse", Expression]
```

### Number Functions

```
NumberFn :
  SumExpr |
  MinExpr |
  MaxExpr |
  AvgExpr |
  CountExpr |
  RoundExpr |
  FloorExpr |
  CeilExpr |
  AbsExpr |
  ClampExpr

SumExpr : ["sum", Expression]

MinExpr : ["min", Expression]

MaxExpr : ["max", Expression]

AvgExpr : ["avg", Expression]

CountExpr : ["count", Expression]

RoundExpr : ["round", Expression, Number?]

FloorExpr : ["floor", Expression]

CeilExpr : ["ceil", Expression]

AbsExpr : ["abs", Expression]

ClampExpr : ["clamp", Expression, Number, Number]
```

### Object Functions

```
ObjectFn :
  HasExpr |
  KeysExpr |
  ValuesExpr |
  EntriesExpr |
  PickExpr |
  OmitExpr

HasExpr : ["has", Expression, String]

KeysExpr : ["keys", Expression]

ValuesExpr : ["values", Expression]

EntriesExpr : ["entries", Expression]

PickExpr : ["pick", Expression, String+]

OmitExpr : ["omit", Expression, String+]
```

### Type Functions

```
TypeFn :
  IsNullExpr |
  IsNumberExpr |
  IsStringExpr |
  IsArrayExpr |
  IsObjectExpr |
  ToNumberExpr |
  ToStringExpr

IsNullExpr : ["isNull", Expression]

IsNumberExpr : ["isNumber", Expression]

IsStringExpr : ["isString", Expression]

IsArrayExpr : ["isArray", Expression]

IsObjectExpr : ["isObject", Expression]

ToNumberExpr : ["toNumber", Expression]

ToStringExpr : ["toString", Expression]
```

### Date Functions

```
DateFn :
  NowExpr |
  DateExpr |
  YearExpr |
  MonthExpr |
  DayExpr |
  DiffExpr

NowExpr : ["now"]

DateExpr : ["date", Expression]

YearExpr : ["year", Expression]

MonthExpr : ["month", Expression]

DayExpr : ["day", Expression]

DiffExpr : ["diff", Expression, Expression, String]
```

---

## B.5 Effect Grammar

```
Effect :
  SetValueEffect |
  SetStateEffect |
  ApiCallEffect |
  NavigateEffect |
  DelayEffect |
  SequenceEffect |
  ParallelEffect |
  ConditionalEffect |
  CatchEffect |
  EmitEventEffect

EffectTag :
  "SetValue" |
  "SetState" |
  "ApiCall" |
  "Navigate" |
  "Delay" |
  "Sequence" |
  "Parallel" |
  "Conditional" |
  "Catch" |
  "EmitEvent"

SetValueEffect :
  _tag "SetValue"
  path SemanticPath
  value Expression
  description String

SetStateEffect :
  _tag "SetState"
  path SemanticPath
  value Expression
  description String

ApiCallEffect :
  _tag "ApiCall"
  endpoint (String | Expression)
  method HttpMethod
  body? Record<String, Expression>
  headers? Record<String, String>
  query? Record<String, Expression>
  timeout? Number
  description String

HttpMethod : "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

NavigateEffect :
  _tag "Navigate"
  to (String | Expression)
  mode? ("push" | "replace")
  description String

DelayEffect :
  _tag "Delay"
  ms Number
  description String

SequenceEffect :
  _tag "Sequence"
  effects Effect[]
  description String

ParallelEffect :
  _tag "Parallel"
  effects Effect[]
  waitAll? Boolean
  description String

ConditionalEffect :
  _tag "Conditional"
  condition Expression
  then Effect
  else? Effect
  description String

CatchEffect :
  _tag "Catch"
  try Effect
  catch Effect
  finally? Effect
  description String

EmitEventEffect :
  _tag "EmitEvent"
  channel EventChannel
  payload EventPayload
  description String

EventChannel : "ui" | "domain" | "analytics"

EventPayload :
  type String
  message? String
  data? unknown
  severity? EventSeverity
  duration? Number

EventSeverity : "success" | "info" | "warning" | "error"

ApiRequest :
  endpoint String
  method String
  body? unknown
  headers? Record<String, String>
  query? Record<String, unknown>
  timeout? Number

EffectHandler :
  setValue (SemanticPath, unknown) => void
  setState (SemanticPath, unknown) => void
  apiCall (ApiRequest) => Promise<unknown>
  navigate (String, ("push" | "replace")?) => void
  emitEvent (String, unknown) => void
```

---

## B.6 Domain Definition Grammar

```
ManifestoDomain :
  id String
  name String
  description String
  paths PathDefinitions
  actions Record<String, ActionDefinition>
  dataSchema ZodType
  stateSchema ZodType
  initialState unknown
  meta? DomainMeta

PathDefinitions :
  sources Record<SemanticPath, SourceDefinition>
  derived Record<SemanticPath, DerivedDefinition>
  async Record<SemanticPath, AsyncDefinition>

SourceDefinition :
  schema ZodType
  defaultValue? unknown
  policy? FieldPolicy
  semantic SemanticMeta

DerivedDefinition :
  deps SemanticPath[]
  expr Expression
  semantic SemanticMeta

AsyncDefinition :
  deps SemanticPath[]
  condition? Expression
  debounce? Number
  effect Effect
  resultPath SemanticPath
  loadingPath SemanticPath
  errorPath SemanticPath
  semantic SemanticMeta

ActionDefinition :
  deps SemanticPath[]
  input? ZodType
  effect Effect
  preconditions? ConditionRef[]
  semantic ActionSemanticMeta

ConditionRef :
  path SemanticPath
  expect? ("true" | "false")
  reason? String

FieldPolicy :
  relevantWhen? ConditionRef[]
  editableWhen? ConditionRef[]
  requiredWhen? ConditionRef[]

SemanticMeta :
  type String
  description String
  importance? Importance
  readable? Boolean
  writable? Boolean
  examples? unknown[]
  hints? Record<String, unknown>

Importance : "critical" | "high" | "medium" | "low"

ActionSemanticMeta : SemanticMeta &
  verb String
  risk? Risk
  expectedOutcome? String
  reversible? Boolean

Risk : "none" | "low" | "medium" | "high" | "critical"

DomainMeta :
  version? String
  category? String
  aiDescription? String
```

---

## B.7 Validation Grammar

```
ValidationResult :
  valid Boolean
  issues ValidationIssue[]

ValidationIssue :
  code String
  message String
  path SemanticPath
  severity Severity
  suggestedFix? SuggestedFix

Severity : "error" | "warning" | "info" | "suggestion"

SuggestedFix :
  description String
  value Expression
```

---

## B.8 Execution Grammar

```
DependencyGraph :
  nodes Map<SemanticPath, DagNode>
  dependencies Map<SemanticPath, Set<SemanticPath>>
  dependents Map<SemanticPath, Set<SemanticPath>>
  topologicalOrder SemanticPath[]

DagNode : SourceNode | DerivedNode | AsyncNode

SourceNode :
  kind "source"
  path SemanticPath
  definition SourceDefinition

DerivedNode :
  kind "derived"
  path SemanticPath
  definition DerivedDefinition

AsyncNode :
  kind "async"
  path SemanticPath
  definition AsyncDefinition

PropagationResult :
  changes Map<SemanticPath, unknown>
  pendingEffects PendingEffect[]
  errors PropagationError[]

PendingEffect :
  path SemanticPath
  effect Effect

PropagationError :
  path SemanticPath
  error Error

EvaluationContext :
  get (SemanticPath) => unknown
  current? unknown
  index? Number
  accumulator? unknown

EvalResult<T> : EvalOk<T> | EvalErr

EvalOk<T> :
  ok true
  value T

EvalErr :
  ok false
  error String
```

---

## B.9 Result Type Grammar

```
Result<T, E> : Ok<T> | Err<E>

Ok<T> :
  ok true
  value T

Err<E> :
  ok false
  error E

EffectError :
  _tag "EffectError"
  effect Effect
  cause Error
  context? EvaluationContext
  code? String
```

---

## B.10 Subscription Grammar

```
SnapshotListener<TData, TState> :
  (snapshot: DomainSnapshot<TData, TState>, changedPaths: SemanticPath[]) => void

PathListener :
  (value: unknown, path: SemanticPath) => void

EventListener :
  (event: DomainEvent) => void

Unsubscribe :
  () => void

DomainEvent :
  channel String
  payload unknown
  timestamp Number

SubscriptionManager<TData, TState> :
  subscribe (listener: SnapshotListener<TData, TState>) => Unsubscribe
  subscribePath (path: SemanticPath, listener: PathListener) => Unsubscribe
  subscribeEvents (channel: String, listener: EventListener) => Unsubscribe
  notifySnapshotChange (snapshot: DomainSnapshot<TData, TState>, changedPaths: SemanticPath[]) => void
  emitEvent (channel: String, payload: unknown) => void
  clear () => void
  getSubscriptionCount () => { snapshot: Number; path: Number; event: Number }
```

---

## B.11 Precondition Grammar

```
PreconditionEvaluationResult :
  condition ConditionRef
  actualValue unknown
  satisfied Boolean
  debug? PreconditionDebug

PreconditionDebug :
  path SemanticPath
  expectedBoolean Boolean
  actualBoolean Boolean

ActionAvailability :
  available Boolean
  unsatisfiedConditions PreconditionEvaluationResult[]
  reasons String[]
  explanation String
```

---

## B.12 Field Policy Grammar

```
ConditionEvaluationDetail :
  condition ConditionRef
  actualValue unknown
  satisfied Boolean

FieldPolicyEvaluation :
  relevant Boolean
  relevantReason? String
  relevantConditions? ConditionEvaluationDetail[]
  editable Boolean
  editableReason? String
  editableConditions? ConditionEvaluationDetail[]
  required Boolean
  requiredReason? String
  requiredConditions? ConditionEvaluationDetail[]

FieldUIState :
  visible Boolean
  enabled Boolean
  showRequired Boolean
  disabledReason? String
  hiddenReason? String
```

---

## B.13 Effect Builder Grammar

```
SetValueBuilder :
  setValue (path: SemanticPath, value: Expression, description: String) => SetValueEffect

SetStateBuilder :
  setState (path: SemanticPath, value: Expression, description: String) => SetStateEffect

ApiCallBuilder :
  apiCall (options: ApiCallOptions) => ApiCallEffect

NavigateBuilder :
  navigate (to: String | Expression, options?: NavigateOptions) => NavigateEffect

DelayBuilder :
  delay (ms: Number, description?: String) => DelayEffect

SequenceBuilder :
  sequence (effects: Effect[], description?: String) => SequenceEffect

ParallelBuilder :
  parallel (effects: Effect[], options?: ParallelOptions) => ParallelEffect

ConditionalBuilder :
  conditional (options: ConditionalOptions) => ConditionalEffect

CatchBuilder :
  catchEffect (options: CatchOptions) => CatchEffect

EmitEventBuilder :
  emitEvent (channel: EventChannel, payload: EventPayload, description?: String) => EmitEventEffect
```

---

## B.14 Result Utility Grammar

```
ResultConstructors :
  ok (value: T) => Result<T, never>
  err (error: E) => Result<never, E>
  effectError (effect: Effect, cause: Error, options?: EffectErrorOptions) => EffectError

ResultTypeGuards :
  isOk (result: Result<T, E>) => result is Ok<T>
  isErr (result: Result<T, E>) => result is Err<E>

ResultExtractors :
  unwrap (result: Result<T, E>) => T
  unwrapOr (result: Result<T, E>, defaultValue: T) => T
  unwrapErr (result: Result<T, E>) => E | undefined

ResultTransformers :
  map (result: Result<T, E>, fn: (T) => U) => Result<U, E>
  mapErr (result: Result<T, E>, fn: (E) => F) => Result<T, F>
  flatMap (result: Result<T, E>, fn: (T) => Result<U, E>) => Result<U, E>
  flatten (result: Result<Result<T, E>, E>) => Result<T, E>

ResultCombinators :
  all (results: Result<T, E>[]) => Result<T[], E>
  any (results: Result<T, E>[]) => Result<T, E[]>

ResultAsync :
  fromPromise (promise: Promise<T>, mapError?: (unknown) => Error) => Promise<Result<T, Error>>
  tryCatch (fn: () => T, mapError?: (unknown) => Error) => Result<T, Error>
```
