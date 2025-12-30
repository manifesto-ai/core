# [Package] Specification v[X.Y]

<!-- INSTRUCTION:
SPEC은 "무엇을 보장하는가"를 정의하는 규범적(normative) 문서입니다.
- RFC 2119 키워드 사용 (MUST, SHOULD, MAY)
- 구현자가 이것만 보고 구현할 수 있어야 함
- 튜토리얼/설명 NO (GUIDE의 역할)
- 왜 이런 결정인지 NO (FDR의 역할)
-->

> **Status:** [Draft | Release]  
> **Scope:** Normative  
> **Version:** [X.Y.Z]  
> **Applies to:** [What this spec governs]

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Definitions](#3-definitions)
4. [Types](#4-types)
5. [Behavior](#5-behavior)
6. [Invariants](#6-invariants)
7. [Error Handling](#7-error-handling)
8. [Explicit Non-Goals](#8-explicit-non-goals)
9. [Compliance](#9-compliance)

---

## 1. Purpose

<!-- INSTRUCTION:
이 스펙이 무엇을 정의하는지 한 문단으로.
-->

This document defines the [PACKAGE] specification for [PROJECT_NAME].

This specification governs:
- [What it governs 1]
- [What it governs 2]
- [What it governs 3]

This document is **normative**.

---

## 2. Scope

### 2.1 What IS Governed

[Package] governs:

| Aspect | Description |
|--------|-------------|
| [Aspect 1] | [What is specified] |
| [Aspect 2] | [What is specified] |

### 2.2 What is NOT Governed

[Package] does **NOT** govern:

| Aspect | Governed By |
|--------|-------------|
| [Aspect 1] | [Other spec/package] |
| [Aspect 2] | [Other spec/package] |

### 2.3 Relationship to Other Specs

```
┌─────────────────┐
│   [Other Spec]  │
└────────┬────────┘
         │ [relationship]
         ▼
┌─────────────────┐
│   THIS SPEC     │
└────────┬────────┘
         │ [relationship]
         ▼
┌─────────────────┐
│   [Other Spec]  │
└─────────────────┘
```

---

## 3. Definitions

<!-- INSTRUCTION:
이 스펙에서 사용하는 용어의 정확한 정의.
GLOSSARY와 일치해야 함.
-->

### 3.1 [Term 1]

[Precise definition]

### 3.2 [Term 2]

[Precise definition]

### 3.3 RFC 2119 Keywords

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## 4. Types

<!-- INSTRUCTION:
모든 타입 정의.
TypeScript 형식 권장.
-->

### 4.1 Core Types

```typescript
/**
 * [Type description]
 */
type [TypeName] = {
  /** [Field description] */
  readonly [field1]: [Type1];
  
  /** [Field description] */
  readonly [field2]: [Type2];
  
  /** [Field description] - Optional */
  readonly [field3]?: [Type3];
};
```

### 4.2 [Category] Types

```typescript
/**
 * [Type description]
 */
type [TypeName] = {
  readonly [field]: [Type];
};

/**
 * [Type description]
 */
type [EnumType] = '[value1]' | '[value2]' | '[value3]';
```

### 4.3 Type Constraints

| Type | Constraint |
|------|------------|
| `[Type1]` | [Constraint description] |
| `[Type2]` | [Constraint description] |

---

## 5. Behavior

<!-- INSTRUCTION:
시스템의 동작 규칙.
MUST/SHOULD/MAY로 명확히.
-->

### 5.1 [Behavior Category 1]

#### 5.1.1 [Specific Behavior]

[Package] **MUST** [behavior description].

```typescript
// Normative example
[code example]
```

#### 5.1.2 [Specific Behavior]

[Package] **MUST NOT** [forbidden behavior].

```typescript
// FORBIDDEN
[forbidden code example]

// REQUIRED
[required code example]
```

#### 5.1.3 [Specific Behavior]

[Package] **SHOULD** [recommended behavior].

[Package] **MAY** [optional behavior].

### 5.2 [Behavior Category 2]

#### 5.2.1 State Machine

<!-- INSTRUCTION:
상태 머신이 있다면 명확히 정의.
-->

```
[State 1] ───[transition]───▶ [State 2]
    │                              │
    │ [transition]                 │ [transition]
    ▼                              ▼
[State 3] ◀───[transition]─── [State 4]
```

| From | Event | To | Condition |
|------|-------|-----|-----------|
| [State1] | [event] | [State2] | [condition] |
| [State2] | [event] | [State3] | [condition] |

#### 5.2.2 [Other Behavior]

[Specification content]

### 5.3 Computation Rules

<!-- INSTRUCTION:
계산/변환 규칙이 있다면 명확히.
-->

#### 5.3.1 [Computation Name]

**Input:** [Input description]

**Output:** [Output description]

**Algorithm:**

1. [Step 1]
2. [Step 2]
3. [Step 3]

**MUST properties:**
- [Property 1]
- [Property 2]

```typescript
// Reference implementation (non-normative)
function [computationName]([params]): [ReturnType] {
  [implementation]
}
```

---

## 6. Invariants

<!-- INSTRUCTION:
항상 유지되어야 하는 불변 조건들.
-->

The following invariants **MUST ALWAYS HOLD**:

### 6.1 [Category] Invariants

| ID | Invariant |
|----|-----------|
| INV-[XX]1 | [Invariant description] |
| INV-[XX]2 | [Invariant description] |
| INV-[XX]3 | [Invariant description] |

### 6.2 [Category] Invariants

| ID | Invariant |
|----|-----------|
| INV-[YY]1 | [Invariant description] |
| INV-[YY]2 | [Invariant description] |

### 6.3 Cross-Cutting Invariants

| ID | Invariant | Applies To |
|----|-----------|------------|
| INV-X1 | [Invariant] | [Scope] |
| INV-X2 | [Invariant] | [Scope] |

---

## 7. Error Handling

<!-- INSTRUCTION:
에러 상황과 그 처리 방법.
-->

### 7.1 Error Types

```typescript
type [Package]Error = 
  | { kind: '[error1]'; [details]: [Type] }
  | { kind: '[error2]'; [details]: [Type] }
  | { kind: '[error3]'; [details]: [Type] };
```

### 7.2 Error Conditions

| Error | Condition | Required Response |
|-------|-----------|-------------------|
| `[error1]` | [When it occurs] | [What MUST happen] |
| `[error2]` | [When it occurs] | [What MUST happen] |

### 7.3 Recovery

[Package] **MUST** [recovery behavior].

[Package] **MUST NOT** [forbidden recovery].

---

## 8. Explicit Non-Goals

<!-- INSTRUCTION:
이 스펙이 명시적으로 다루지 않는 것들.
-->

This specification does **NOT** define:

| Non-Goal | Reason | Defined By |
|----------|--------|------------|
| [Non-goal 1] | [Why not here] | [Where it is defined] |
| [Non-goal 2] | [Why not here] | [Where it is defined] |
| [Non-goal 3] | [Why not here] | [Application concern] |

---

## 9. Compliance

### 9.1 Compliance Requirements

An implementation claiming compliance with **[Package] Spec v[X.Y]** MUST:

1. Implement all types defined in this document
2. Enforce all invariants (INV-*)
3. Follow all MUST requirements
4. [Other requirement]
5. [Other requirement]

### 9.2 Compliance Verification

Compliance can be verified by:

1. **Type checking:** All structures match specification
2. **Invariant testing:** All INV-* hold under test scenarios
3. **Behavior testing:** All MUST requirements are enforced
4. [Other verification]

### 9.3 Non-Compliance Consequences

Failure to comply with this Spec:

- [Consequence 1]
- [Consequence 2]
- [Consequence 3]

---

## Appendix A: Quick Reference

### A.1 Core Types Summary

```typescript
type [Type1] = { ... }
type [Type2] = { ... }
type [Type3] = { ... }
```

### A.2 State Machine Summary

```
[Compact state diagram]
```

### A.3 Key Invariants Summary

| Category | Key Rule |
|----------|----------|
| [Cat1] | [Summary] |
| [Cat2] | [Summary] |

---

## Appendix B: Cross-Reference

### B.1 Related Specifications

| Spec | Relationship |
|------|--------------|
| [Spec 1] | [How related] |
| [Spec 2] | [How related] |

### B.2 FDR Reference

| FDR | Explains |
|-----|----------|
| FDR-[XXX] | [What decision] |
| FDR-[YYY] | [What decision] |

---

## Appendix C: Revision History

| Version | Date | Changes |
|---------|------|---------|
| [X.Y.0] | [Date] | Initial release |
| [X.Y.1] | [Date] | [Changes] |

---

*End of [Package] Specification v[X.Y]*
