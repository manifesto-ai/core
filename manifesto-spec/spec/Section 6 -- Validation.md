# Section 6 -- Validation

## 6.1 Overview

Validation ensures that domain definitions, paths, values, and effects meet specification requirements. Manifesto provides multiple validation layers:

1. **Domain Validation**: Validates the domain definition structure
2. **Path Validation**: Ensures paths are valid and accessible
3. **Schema Validation**: Validates values against Zod schemas
4. **Effect Validation**: Ensures effects are correctly formed

---

## 6.2 ValidationResult Type

### 6.2.1 Type Definition

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

### 6.2.2 Field Descriptions

**ValidationResult:**

| Field | Type | Description |
|-------|------|-------------|
| `valid` | boolean | True if no errors (warnings allowed) |
| `issues` | ValidationIssue[] | List of validation issues |

**ValidationIssue:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Machine-readable error code |
| `message` | string | Yes | Human-readable description |
| `path` | SemanticPath | Yes | Path where issue occurred |
| `severity` | enum | Yes | Issue severity level |
| `suggestedFix` | object | No | Automated fix suggestion |

### 6.2.3 Severity Levels

| Severity | Meaning | Affects `valid` |
|----------|---------|-----------------|
| `error` | Must be fixed | Yes (makes `valid` false) |
| `warning` | Should be addressed | No |
| `info` | Informational | No |
| `suggestion` | Improvement opportunity | No |

---

## 6.3 Validation Codes

### 6.3.1 Domain Validation Codes

| Code | Severity | Description |
|------|----------|-------------|
| `DOMAIN_ID_REQUIRED` | error | Domain id is missing or empty |
| `DOMAIN_NAME_REQUIRED` | error | Domain name is missing or empty |
| `MISSING_DEPENDENCY` | error | Referenced path is not defined |
| `CYCLIC_DEPENDENCY` | error | Circular dependency detected in DAG |
| `INVALID_PRECONDITION_PATH` | error | Precondition references undefined path |
| `ACTION_VERB_REQUIRED` | warning | Action missing semantic verb |

### 6.3.2 Path Validation Codes

| Code | Severity | Description |
|------|----------|-------------|
| `INVALID_PATH_SYNTAX` | error | Path does not match grammar |
| `UNKNOWN_NAMESPACE` | error | Path uses unknown namespace |
| `READONLY_VIOLATION` | error | Attempt to write to derived path |
| `PATH_NOT_FOUND` | error | Path does not exist in snapshot |
| `INDEX_OUT_OF_BOUNDS` | error | Array index exceeds bounds |

### 6.3.3 Schema Validation Codes

| Code | Severity | Description |
|------|----------|-------------|
| `TYPE_MISMATCH` | error | Value type doesn't match schema |
| `REQUIRED_FIELD` | error | Required field is missing |
| `INVALID_FORMAT` | error | Value format is invalid |
| `CONSTRAINT_VIOLATION` | error | Value violates schema constraint |

### 6.3.4 Effect Validation Codes

| Code | Severity | Description |
|------|----------|-------------|
| `INVALID_EFFECT_TAG` | error | Unknown effect _tag |
| `MISSING_REQUIRED_FIELD` | error | Effect missing required field |
| `INVALID_EXPRESSION` | error | Effect contains invalid expression |

---

## 6.4 Domain Validation

### 6.4.1 ValidateDomainOptions

```typescript
type ValidateDomainOptions = {
  checkCycles?: boolean;
  checkUnused?: boolean;
  checkMissingDeps?: boolean;
};
```

| Option | Default | Description |
|--------|---------|-------------|
| `checkCycles` | true | Check for cyclic dependencies |
| `checkUnused` | true | Check for unused path definitions |
| `checkMissingDeps` | true | Check for missing dependencies |

### 6.4.2 ValidateDomain Algorithm

```
ValidateDomain(domain, options):
1. Let {issues} be an empty array.
2. If {domain}.id is empty or whitespace:
   a. Append DOMAIN_ID_REQUIRED error to {issues}.
3. If {domain}.name is empty or whitespace:
   a. Append DOMAIN_NAME_REQUIRED error to {issues}.
4. Let {allPaths} be CollectAllPaths({domain}).
5. If {options}.checkMissingDeps is true:
   a. Append FindMissingDependencies({domain}, {allPaths}) to {issues}.
6. If {options}.checkCycles is true:
   a. Append FindCyclicDependencies({domain}) to {issues}.
7. Append ValidateActions({domain}, {allPaths}) to {issues}.
8. Let {hasErrors} be true if any issue has severity "error".
9. Return { valid: not {hasErrors}, issues: {issues} }.
```

### 6.4.3 CollectAllPaths

Collects all defined paths in a domain.

```
CollectAllPaths(domain):
1. Let {paths} be an empty set.
2. For each {path} in {domain}.paths.sources:
   a. Add {path} to {paths}.
3. For each {path} in {domain}.paths.derived:
   a. Add {path} to {paths}.
4. For each {path}, {def} in {domain}.paths.async:
   a. Add {path} to {paths}.
   b. Add {def}.resultPath to {paths}.
   c. Add {def}.loadingPath to {paths}.
   d. Add {def}.errorPath to {paths}.
5. Return {paths}.
```

### 6.4.4 FindMissingDependencies

Finds references to undefined paths.

```
FindMissingDependencies(domain, allPaths):
1. Let {issues} be an empty array.
2. For each {path}, {def} in {domain}.paths.derived:
   a. For each {dep} in {def}.deps:
      i. If {dep} not in {allPaths} and not IsBuiltInPath({dep}):
         1. Append MISSING_DEPENDENCY error for {path} -> {dep}.
3. For each {path}, {def} in {domain}.paths.async:
   a. For each {dep} in {def}.deps:
      i. If {dep} not in {allPaths} and not IsBuiltInPath({dep}):
         1. Append MISSING_DEPENDENCY error for {path} -> {dep}.
4. For each {actionId}, {def} in {domain}.actions:
   a. For each {dep} in {def}.deps:
      i. If {dep} not in {allPaths} and not IsBuiltInPath({dep}):
         1. Append MISSING_DEPENDENCY error for action {actionId} -> {dep}.
5. Return {issues}.
```

### 6.4.5 FindCyclicDependencies

Detects circular dependencies using DFS.

```
FindCyclicDependencies(domain):
1. Let {issues} be an empty array.
2. Let {graph} be a dependency graph from {domain}.
3. Let {visited} be an empty set.
4. Let {recursionStack} be an empty set.
5. For each {node} in {graph}:
   a. If {node} not in {visited}:
      i. If DFS({node}, [{node}]) finds cycle:
         1. Append CYCLIC_DEPENDENCY error with cycle path.
6. Return {issues}.

DFS(node, pathStack):
1. Add {node} to {visited}.
2. Add {node} to {recursionStack}.
3. For each {dep} in dependencies of {node}:
   a. If {dep} not in {visited}:
      i. If DFS({dep}, [...{pathStack}, {dep}]) returns true:
         1. Return true (cycle found).
   b. Else if {dep} in {recursionStack}:
      i. Record cycle: {pathStack}[indexOf({dep})..] + {dep}.
      ii. Return true.
4. Remove {node} from {recursionStack}.
5. Return false.
```

### 6.4.6 ValidateActions

Validates action definitions.

```
ValidateActions(domain, allPaths):
1. Let {issues} be an empty array.
2. For each {actionId}, {def} in {domain}.actions:
   a. If {def}.preconditions exists:
      i. For each {cond} in {def}.preconditions:
         1. If {cond}.path not in {allPaths} and not IsBuiltInPath({cond}.path):
            a. Append INVALID_PRECONDITION_PATH error.
   b. If {def}.semantic.verb is empty:
      i. Append ACTION_VERB_REQUIRED warning.
3. Return {issues}.
```

---

## 6.5 Path Validation

### 6.5.1 Path Write Validation

Derived paths are read-only. Attempts to write **MUST** be rejected.

```
ValidatePathWrite(path):
1. If {path} starts with "derived.":
   a. Return error READONLY_VIOLATION.
2. Return success.
```

**Example № 1** *Readonly validation*

```typescript
// Valid writes
validatePathWrite('data.user.name');  // OK
validatePathWrite('state.isLoading'); // OK

// Invalid write
validatePathWrite('derived.total');   // Error: READONLY_VIOLATION
```

### 6.5.2 Path Bounds Validation

For array access, indices **MUST** be within bounds.

```
ValidatePathBounds(snapshot, path):
1. Let {segments} be ParsePath({path}).
2. Let {current} be GetNamespaceRoot({snapshot}, {segments}[0]).
3. For each {segment} in {segments}[1..]:
   a. If {segment} is a number and {current} is an array:
      i. If {segment} < 0, return error INDEX_OUT_OF_BOUNDS.
      ii. If {segment} >= length({current}), return error INDEX_OUT_OF_BOUNDS.
      iii. Set {current} to {current}[{segment}].
   b. Else if {current} is an object:
      i. Set {current} to {current}[{segment}].
   c. Else:
      i. Return error PATH_NOT_FOUND.
4. Return success.
```

---

## 6.6 Schema Validation

### 6.6.1 Zod Integration

Source paths have Zod schemas for validation. A conforming implementation **MUST** validate values against their schemas before setting.

```
ValidateValue(schema, value):
1. Let {result} be schema.safeParse({value}).
2. If {result}.success is true:
   a. Return { valid: true, issues: [] }.
3. Else:
   a. Let {issues} be MapZodErrors({result}.error).
   b. Return { valid: false, issues: {issues} }.
```

### 6.6.2 MapZodErrors

Converts Zod errors to ValidationIssues.

```
MapZodErrors(zodError):
1. Let {issues} be an empty array.
2. For each {error} in {zodError}.issues:
   a. Let {issue} be {
        code: MapZodCode({error}.code),
        message: {error}.message,
        path: JoinPath({error}.path),
        severity: 'error'
      }.
   b. Append {issue} to {issues}.
3. Return {issues}.
```

**Example № 2** *Schema validation*

```typescript
const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150)
});

validateValue(schema, { email: 'invalid', age: -5 });
// {
//   valid: false,
//   issues: [
//     { code: 'INVALID_FORMAT', path: 'email', message: 'Invalid email' },
//     { code: 'CONSTRAINT_VIOLATION', path: 'age', message: 'Number must be >= 0' }
//   ]
// }
```

---

## 6.7 Effect Validation

### 6.7.1 ValidateEffect

Validates effect structure and content.

```
ValidateEffect(effect):
1. If {effect} is null or not an object:
   a. Return error INVALID_EFFECT_TAG.
2. If {effect}._tag is not a valid effect tag:
   a. Return error INVALID_EFFECT_TAG.
3. Match {effect}._tag:
   a. "SetValue": return ValidateSetValueEffect({effect}).
   b. "SetState": return ValidateSetStateEffect({effect}).
   c. "ApiCall": return ValidateApiCallEffect({effect}).
   [... continue for all effect types ...]
4. Return success.
```

### 6.7.2 ValidateSetValueEffect

```
ValidateSetValueEffect(effect):
1. If {effect}.path is not a string:
   a. Return error MISSING_REQUIRED_FIELD for "path".
2. If not {effect}.path starts with "data.":
   a. Return error INVALID_PATH_SYNTAX.
3. If {effect}.value is not a valid Expression:
   a. Return error INVALID_EXPRESSION.
4. If {effect}.description is not a string:
   a. Return error MISSING_REQUIRED_FIELD for "description".
5. Return success.
```

---

## 6.8 Invariant Validation

### 6.8.1 Pre/Post Invariants

Invariants are conditions that **MUST** hold before or after operations.

```typescript
type Invariant = {
  name: string;
  condition: Expression;
  message: string;
};
```

### 6.8.2 Built-in Invariants

**Required Field Invariant:**

```
RequiredFieldInvariant(path):
1. Return {
     name: 'required_' + {path},
     condition: ['!', ['isNull', ['get', {path}]]],
     message: '{path} is required'
   }.
```

**Range Invariant:**

```
RangeInvariant(path, min, max):
1. Return {
     name: 'range_' + {path},
     condition: ['all',
       ['>=', ['get', {path}], {min}],
       ['<=', ['get', {path}], {max}]
     ],
     message: '{path} must be between {min} and {max}'
   }.
```

**Array Length Invariant:**

```
ArrayLengthInvariant(path, min, max):
1. Return {
     name: 'length_' + {path},
     condition: ['all',
       ['>=', ['length', ['get', {path}]], {min}],
       ['<=', ['length', ['get', {path}]], {max}]
     ],
     message: '{path} length must be between {min} and {max}'
   }.
```

### 6.8.3 ValidateInvariants

```
ValidateInvariants(snapshot, invariants):
1. Let {issues} be an empty array.
2. Let {context} be CreateEvaluationContext({snapshot}).
3. For each {invariant} in {invariants}:
   a. Let {result} be Evaluate({invariant}.condition, {context}).
   b. If {result} is not true:
      i. Append {
           code: 'INVARIANT_VIOLATION',
           message: {invariant}.message,
           path: ExtractPrimaryPath({invariant}.condition),
           severity: 'error'
         } to {issues}.
4. Return { valid: length({issues}) === 0, issues: {issues} }.
```

---

## 6.9 Validation Pipeline

### 6.9.1 Complete Validation Flow

For write operations, validation follows this pipeline:

```
ValidateWriteOperation(snapshot, path, value, domain):
1. Let {issues} be an empty array.

// Phase 1: Path Validation
2. Let {pathResult} be ValidatePathWrite({path}).
3. If {pathResult} is error, append to {issues} and return.

// Phase 2: Bounds Validation
4. Let {boundsResult} be ValidatePathBounds({snapshot}, {path}).
5. If {boundsResult} is error, append to {issues}.

// Phase 3: Schema Validation
6. Let {sourceDef} be GetSourceDefinition({domain}, {path}).
7. If {sourceDef} exists:
   a. Let {schemaResult} be ValidateValue({sourceDef}.schema, {value}).
   b. Append {schemaResult}.issues to {issues}.

// Phase 4: Invariant Validation (post-state)
8. Let {newSnapshot} be ApplyChange({snapshot}, {path}, {value}).
9. Let {invariantResult} be ValidateInvariants({newSnapshot}, GetInvariants({domain})).
10. Append {invariantResult}.issues to {issues}.

11. Return { valid: no errors in {issues}, issues: {issues} }.
```

### 6.9.2 Fail Fast vs Collect All

A conforming implementation **MAY** choose between:

1. **Fail Fast**: Stop at first error, return immediately
2. **Collect All**: Gather all issues before returning

Both approaches are valid. Fail fast is more efficient; collect all provides better diagnostics.

---

## 6.10 Validation Error Handling

### 6.10.1 Error Response

When validation fails, operations **MUST NOT** proceed. The runtime **MUST**:

1. Return a Result with the validation errors
2. Leave the snapshot unchanged
3. Not trigger any side effects

**Example № 3** *Validation error handling*

```typescript
const result = runtime.set('data.age', -5);

if (!result.ok) {
  console.log(result.error);
  // {
  //   code: 'CONSTRAINT_VIOLATION',
  //   message: 'Number must be >= 0',
  //   path: 'data.age',
  //   severity: 'error'
  // }
}
```

### 6.10.2 Suggested Fixes

For certain validation errors, implementations **MAY** provide suggested fixes.

**Example № 4** *Suggested fix*

```typescript
{
  code: 'CONSTRAINT_VIOLATION',
  message: 'Value exceeds maximum of 100',
  path: 'data.quantity',
  severity: 'error',
  suggestedFix: {
    description: 'Clamp to maximum allowed value',
    value: 100
  }
}
```
