# Error Reference

This document provides a comprehensive reference for all error codes in `@manifesto-ai/compiler`.

## Table of Contents

- [Compiler Errors (CompilerErrorCode)](#compiler-errors)
- [Validation Issues (IssueCode)](#validation-issues)
- [Safety Issues](#safety-issues)

---

## Compiler Errors

Compiler errors are returned via the `Result<T, CompilerError>` monad. They indicate failures during compilation operations.

### Fragment Errors

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `FRAGMENT_NOT_FOUND` | Error | Referenced fragment does not exist | Verify fragment ID exists before referencing |
| `FRAGMENT_ALREADY_EXISTS` | Error | Fragment with the same ID already exists | Use a unique ID or update existing fragment |
| `INVALID_FRAGMENT_KIND` | Error | Fragment kind doesn't match expected type | Ensure correct fragment type is used for operation |

### Path Errors

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `PATH_NOT_FOUND` | Error | Semantic path not found in schema | Define the path in a SchemaFragment or SourceFragment |
| `INVALID_PATH` | Error | Path format is invalid | Follow semantic path format: `namespace.segment.segment` |
| `SELF_REFERENCE` | Error | Path references itself | Remove circular reference in derived expression |

### Dependency Errors

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `DEP_NOT_FOUND` | Error | Dependency path not found | Add the missing dependency definition |
| `DEP_ALREADY_EXISTS` | Error | Dependency already registered | Check for duplicate dependency declarations |
| `CYCLE_DETECTED` | Error | Circular dependency detected in DAG | Refactor to remove circular dependencies |
| `MISSING_DEPENDENCY` | Error | Required dependency is missing | Add the missing path definition |

### Conflict Errors

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `CONFLICT_NOT_FOUND` | Error | Referenced conflict does not exist | Verify conflict ID before resolution |
| `DUPLICATE_PROVIDES` | Error | Multiple fragments provide the same path | Resolve conflict by choosing one fragment |

### Codebook/Alias Errors

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `CODEBOOK_REQUIRED` | Error | Operation requires a codebook | Provide a codebook for alias operations |
| `CODEBOOK_MISMATCH` | Error | Codebook ID doesn't match | Use the correct codebook for the operation |
| `ALIAS_NOT_FOUND` | Error | Alias entry not found | Verify alias ID exists |
| `ALIAS_CONFLICT` | Error | Alias conflicts with existing mapping | Resolve or remove conflicting alias |
| `ALIAS_WRONG_STATE` | Error | Alias is in wrong state for operation | Check alias status (suggested/applied/rejected) |

### Schema Errors

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `SCHEMA_NOT_FOUND` | Error | Schema not found for namespace | Define a SchemaFragment for the namespace |
| `FIELD_NOT_FOUND` | Error | Field not found in schema | Add field definition to SchemaFragment |

### Operation Errors

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `UNKNOWN_OPERATION` | Error | Unknown patch operation type | Use valid patch operation types |
| `INVALID_OPERATION` | Error | Operation is invalid in current context | Check operation preconditions |
| `INTERNAL_ERROR` | Error | Internal compiler error | Report bug with reproduction steps |

---

## Validation Issues

Validation issues are returned during the verify phase. They indicate problems with fragments or the linked domain.

### Domain Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `DOMAIN_ID_REQUIRED` | Error | Domain ID is required but missing | Provide a domain ID in configuration |
| `DOMAIN_NAME_REQUIRED` | Error | Domain name is required but missing | Provide a domain name |

### Dependency Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `MISSING_DEPENDENCY` | Error | Path depends on undefined path | Add SourceFragment or DerivedFragment for the dependency |
| `CYCLIC_DEPENDENCY` | Error | Cyclic dependency chain detected | Refactor to break the cycle |
| `UNUSED_PATH` | Info | Path is defined but never used | Consider removing unused definition |

### Path Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `INVALID_PATH` | Error | Path format is invalid | Use valid semantic path format |
| `PATH_NOT_FOUND` | Error | Referenced path does not exist | Define the path before referencing |
| `DUPLICATE_PATH` | Error | Path is defined multiple times | Remove duplicate definitions |

### Schema Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `SCHEMA_MISMATCH` | Error | Schema types don't match between fragments | Align types across fragments |
| `INVALID_SCHEMA` | Error | Schema definition is invalid | Fix schema structure |
| `MISSING_DEFAULT_VALUE` | Warning | Required field missing default value | Provide default value for field |
| `UNKNOWN_TYPE` | Error | Type is not recognized | Use supported schema types |
| `EMPTY_DATA_SCHEMA` | Warning | Data schema has no fields | Add field definitions |

### Action Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `INVALID_PRECONDITION_PATH` | Error | Action precondition references invalid path | Fix path in precondition |
| `ACTION_VERB_REQUIRED` | Warning | Action name should be a verb | Rename action to start with verb |
| `ACTION_NOT_FOUND` | Error | Referenced action does not exist | Define the action first |
| `MISSING_ACTION_EFFECT` | Error | Action is missing effect definition | Add effect to action |
| `ACTION_WITHOUT_EFFECT` | Warning | Action has no effect | Add meaningful effect |

### Effect Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `EFFECT_RISK_TOO_HIGH` | Warning | Effect risk exceeds policy maximum | Lower risk level or adjust policy |
| `INVALID_EFFECT` | Error | Effect definition is invalid | Fix effect AST structure |
| `MISSING_EFFECT_REF` | Error | Referenced effect not found | Define the effect |

### Expression Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `INVALID_EXPRESSION` | Error | Expression is syntactically invalid | Fix expression syntax |
| `EXPRESSION_TYPE_MISMATCH` | Error | Expression type doesn't match expected | Align expression return type |

### Linker Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `DUPLICATE_PROVIDES` | Error | Multiple fragments provide same path | Resolve conflict |
| `UNRESOLVED_REFERENCE` | Error | Reference could not be resolved | Check reference target exists |
| `LINK_ERROR` | Error | General linking error | Check linker output for details |

### Provenance Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `MISSING_PROVENANCE` | Error | Fragment is missing origin/evidence | Add provenance information |
| `INVALID_PROVENANCE` | Error | Provenance data is malformed | Fix provenance structure |

### Core Validation

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `CORE_VALIDATION_ERROR` | Error | Core validation failed | Check Core runtime error message |

---

## Safety Issues

Safety issues are generated by the HITL Gate and Allowlist Validator (PRD 6.9).

### HITL (Human-in-the-Loop) Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `HITL_APPROVAL_REQUIRED` | Error | High-risk effect requires human approval | Submit for approval via HITL callback |
| `HITL_APPROVAL_DENIED` | Error | Human reviewer denied the effect | Modify effect or provide justification |
| `HITL_APPROVAL_TIMEOUT` | Error | Approval request timed out | Retry or increase timeout |

**HITL Configuration Example:**
```typescript
const config: HITLConfig = {
  requireApprovalFor: ['high', 'critical'],
  onApprovalRequest: async (request) => {
    // Present to reviewer
    return { approved: true, approvedBy: 'user@example.com' };
  },
  approvalTimeout: 60000, // 1 minute
};
```

### Allowlist Issues

| Code | Severity | Description | Solution |
|------|----------|-------------|----------|
| `ENDPOINT_NOT_ALLOWED` | Error | API endpoint not in allowlist | Add endpoint to `allowedEndpoints` or remove call |
| `EFFECT_TYPE_NOT_ALLOWED` | Error | Effect type not in allowlist | Add effect type to `allowedEffectTypes` or change effect |

**Allowlist Configuration Example:**
```typescript
const policy: EffectPolicy = {
  maxRisk: 'high',
  allowedEndpoints: ['/api/safe', '/api/approved'],
  allowedEffectTypes: ['sequence', 'set', 'apiCall'],
};
```

---

## Error Handling Patterns

### Using Result Monad

```typescript
import { ok, err, isOk, isErr, map, flatMap } from '@manifesto-ai/compiler';

const result = someOperation();

if (isOk(result)) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error.code, result.error.message);
}

// Chain operations
const chained = flatMap(result, (value) => anotherOperation(value));
```

### Filtering Issues by Severity

```typescript
import {
  filterIssuesBySeverity,
  getErrorIssues,
  getWarningIssues,
  isBlockingIssue
} from '@manifesto-ai/compiler';

const errors = getErrorIssues(issues);
const warnings = getWarningIssues(issues);
const blocking = issues.filter(isBlockingIssue);
```

### HITL Gate Integration

```typescript
import {
  createHITLGate,
  checkFragmentsForHITL,
  generateHITLIssues
} from '@manifesto-ai/compiler';

// Check which fragments need approval
const needsApproval = checkFragmentsForHITL(fragments, config);

// Generate issues for blocking
const issues = generateHITLIssues(fragments, config);

// Or use the gate directly
const gate = createHITLGate(config);
for (const fragment of fragments) {
  if (gate.requiresApproval(fragment)) {
    const result = await gate.requestApproval(fragment);
    // Handle result
  }
}
```

### Allowlist Validation

```typescript
import {
  validateAllowlist,
  generateAllowlistIssues,
  hasAllowlistViolations
} from '@manifesto-ai/compiler';

// Quick check
if (hasAllowlistViolations(fragments, policy)) {
  const issues = generateAllowlistIssues(fragments, policy);
  // Handle violations
}

// Detailed violations
const violations = validateAllowlist(fragments, policy);
for (const v of violations) {
  console.log(`${v.violationType}: ${v.value} not in [${v.allowedValues}]`);
}
```

---

## Troubleshooting

### Common Issues

**"MISSING_DEPENDENCY" for a path that should exist**
- Check if the SchemaFragment or SourceFragment is included in artifacts
- Verify path spelling matches exactly (case-sensitive)
- Ensure fragment is processed before dependent fragments

**"CYCLE_DETECTED" unexpectedly**
- Use `explain()` to trace the dependency chain
- Check for indirect cycles through derived expressions
- Consider breaking the cycle with a SourceFragment

**"HITL_APPROVAL_REQUIRED" blocking compilation**
- Configure `onApprovalRequest` callback in HITLConfig
- Or lower the effect risk level
- Or adjust `requireApprovalFor` configuration

**"ENDPOINT_NOT_ALLOWED" for valid endpoint**
- Check endpoint string matches exactly
- Add endpoint to `allowedEndpoints` array
- Consider using pattern matching if supported

### Getting Help

For additional support:
1. Check the test files for usage examples
2. Review the AGENT_README for invariants
3. Open an issue at the repository
