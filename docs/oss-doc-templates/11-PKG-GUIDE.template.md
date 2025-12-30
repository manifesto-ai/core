# [Package] Guide

<!-- INSTRUCTION:
GUIDE는 "어떻게 쓰는지"를 설명하는 실용적인 문서입니다.
- 모든 코드는 복붙해서 실행 가능해야 함
- 철학/이론 설명 NO
- 단계별로 따라할 수 있어야 함
- 흔한 실수와 해결책 포함
-->

> **Purpose:** Practical guide for using [Package]  
> **Prerequisites:** Basic understanding of [PROJECT_NAME] concepts  
> **Time to complete:** ~[X] minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Common Patterns](#common-patterns)
4. [Advanced Usage](#advanced-usage)
5. [Common Mistakes](#common-mistakes)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
npm install @[org]/[package]
```

### Minimal Setup

<!-- INSTRUCTION:
최소한의 동작 코드. 복붙하면 바로 실행됨.
-->

```typescript
// 1. Import
import { [mainExport] } from '@[org]/[package]';

// 2. Setup
const [instance] = [mainExport]({
  // Minimal required config
});

// 3. Verify
console.log([instance].[someProperty]);
// → [expected_output]
```

### Project Structure

<!-- INSTRUCTION:
권장하는 프로젝트 구조가 있다면 제시.
-->

```
my-project/
├── src/
│   ├── [recommended_file_1].ts
│   ├── [recommended_file_2].ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

## Basic Usage

### [Use Case 1]: [Title]

<!-- INSTRUCTION:
가장 기본적인 사용 사례.
1. 무엇을 할 것인지
2. 코드
3. 결과 확인
-->

**Goal:** [What we're trying to do]

```typescript
// Step 1: [Description]
const [something] = [code];

// Step 2: [Description]
const [result] = [instance].[method]([args]);

// Step 3: Verify
console.log([result]);
// → [expected_output]
```

### [Use Case 2]: [Title]

**Goal:** [What we're trying to do]

```typescript
// [Similar structure]
```

### [Use Case 3]: [Title]

**Goal:** [What we're trying to do]

```typescript
// [Similar structure]
```

---

## Common Patterns

### Pattern 1: [Pattern Name]

<!-- INSTRUCTION:
자주 사용되는 패턴.
"왜" 이 패턴인지는 설명하지 않음 (FDR의 역할).
"어떻게" 사용하는지만.
-->

**When to use:** [Brief description]

```typescript
// The pattern
const [pattern] = {
  [key]: [value],
  [key]: [value],
};

// Usage
[instance].[method]([pattern]);
```

**Example:**

```typescript
// Concrete example
const [concreteExample] = {
  [actualKey]: [actualValue],
};
```

### Pattern 2: [Pattern Name]

**When to use:** [Brief description]

```typescript
// [Similar structure]
```

### Pattern 3: [Pattern Name]

**When to use:** [Brief description]

```typescript
// [Similar structure]
```

---

## Advanced Usage

### [Advanced Topic 1]

<!-- INSTRUCTION:
기본을 넘어서는 고급 사용법.
필요한 사람만 읽으면 됨.
-->

**Prerequisites:** Understanding of [basic concept]

```typescript
// Advanced usage
import { [advancedExport] } from '@[org]/[package]';

const [advanced] = [advancedExport]({
  [advancedConfig]: [value],
});
```

### [Advanced Topic 2]

```typescript
// [Similar structure]
```

### Customization

<!-- INSTRUCTION:
커스터마이징 방법.
-->

**Extending default behavior:**

```typescript
const [custom] = [mainExport]({
  [customOption]: [value],
  [anotherOption]: (args) => {
    // Custom implementation
    return [result];
  },
});
```

---

## Common Mistakes

<!-- INSTRUCTION:
이 섹션이 매우 중요합니다.
실제로 사람들이 자주 하는 실수를 문서화합니다.
-->

### ❌ Mistake 1: [Description]

**What people do:**

```typescript
// Wrong
[wrongCode]
```

**Why it's wrong:** [Brief explanation]

**Correct approach:**

```typescript
// Right
[correctCode]
```

### ❌ Mistake 2: [Description]

**What people do:**

```typescript
// Wrong
[wrongCode]
```

**Why it's wrong:** [Brief explanation]

**Correct approach:**

```typescript
// Right
[correctCode]
```

### ❌ Mistake 3: [Description]

**What people do:**

```typescript
// Wrong
[wrongCode]
```

**Why it's wrong:** [Brief explanation]

**Correct approach:**

```typescript
// Right
[correctCode]
```

---

## Troubleshooting

### Error: [Error Message]

**Cause:** [Why this happens]

**Solution:**

```typescript
// Fix
[fixCode]
```

### Error: [Error Message]

**Cause:** [Why this happens]

**Solution:**

```typescript
// Fix
[fixCode]
```

### [Symptom]: [Description]

**Cause:** [Why this happens]

**Diagnosis:**

```typescript
// Check this
console.log([diagnostic]);
```

**Solution:**

```typescript
// Fix
[fixCode]
```

---

## Testing

<!-- INSTRUCTION:
테스트 방법.
-->

### Unit Testing

```typescript
import { [testExport] } from '@[org]/[package]';
import { describe, it, expect } from 'vitest'; // or jest

describe('[Package]', () => {
  it('[test description]', () => {
    // Arrange
    const [setup] = [setupCode];
    
    // Act
    const result = [instance].[method]([args]);
    
    // Assert
    expect(result).[matcher]([expected]);
  });
});
```

### Integration Testing

```typescript
// Integration test example
```

---

## Next Steps

- **Deep dive:** Read [SPEC.md](./SPEC.md) for complete API reference
- **Understand why:** Read [FDR.md](./FDR.md) for design rationale
- **See examples:** Check [examples/](../../examples/) directory
- **Get help:** Open an [issue](link) or [discussion](link)

---

## Quick Reference

<!-- INSTRUCTION:
한 눈에 볼 수 있는 빠른 참조.
-->

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `[api1]()` | [Purpose] | `[example]` |
| `[api2]()` | [Purpose] | `[example]` |
| `[api3]()` | [Purpose] | `[example]` |

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `[option1]` | `[type]` | `[default]` | [Description] |
| `[option2]` | `[type]` | `[default]` | [Description] |

### Checklist

Before going to production:

- [ ] [Checklist item 1]
- [ ] [Checklist item 2]
- [ ] [Checklist item 3]

---

*End of Guide*
