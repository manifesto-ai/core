# @[org]/[package]

<!-- INSTRUCTION:
파일 위치: packages/[package]/README.md (패키지 루트)

패키지별 README는 "이 패키지가 뭐고 왜 쓰는지"를 설명합니다.
전체 프로젝트 README와 중복되지 않게 주의하세요.
이 패키지의 고유한 역할에 집중합니다.
-->

> **[Package]** is the [ROLE] layer of [PROJECT_NAME].

---

## What is [Package]?

<!-- INSTRUCTION:
2-3문장으로 이 패키지의 역할을 설명합니다.
전체 시스템에서의 위치를 명확히.
-->

[Package] is responsible for [PRIMARY_RESPONSIBILITY].

In the [PROJECT_NAME] architecture:

```
[Other Layer] ──→ [THIS PACKAGE] ──→ [Other Layer]
                       │
              [What this layer does]
```

---

## What [Package] Does

<!-- INSTRUCTION:
이 패키지가 "하는 것"을 명시합니다.
-->

| Responsibility | Description |
|----------------|-------------|
| ✅ [Does 1] | [Brief explanation] |
| ✅ [Does 2] | [Brief explanation] |
| ✅ [Does 3] | [Brief explanation] |

---

## What [Package] Does NOT Do

<!-- INSTRUCTION:
매우 중요합니다.
이 패키지의 경계를 명확히 합니다.
-->

| NOT Responsible For | Who Is |
|--------------------|--------|
| ❌ [Doesn't 1] | [Other Package] |
| ❌ [Doesn't 2] | [Other Package] |
| ❌ [Doesn't 3] | [Application] |

---

## Installation

```bash
npm install @[org]/[package]
# or
yarn add @[org]/[package]
# or
pnpm add @[org]/[package]
```

### Peer Dependencies

<!-- INSTRUCTION:
필요한 peer dependency가 있다면 명시합니다.
-->

```bash
npm install @[org]/core  # Required peer
```

---

## Quick Example

<!-- INSTRUCTION:
복붙해서 바로 실행 가능한 최소 예제.
이 패키지의 핵심 API만 보여줍니다.
-->

```typescript
import { [mainExport] } from '@[org]/[package]';

// Setup
const [instance] = [mainExport]({
  [minimalConfig]: [value]
});

// Usage
const result = [instance].[method]([args]);

console.log(result);
// → [expected_output]
```

→ See [GUIDE.md](./docs/GUIDE.md) for the full tutorial.

---

## Core Concepts

<!-- INSTRUCTION:
이 패키지에서 사용하는 핵심 개념 3-5개.
상세 설명은 GUIDE나 SPEC으로 링크.
-->

### [Concept 1]

[One paragraph explanation]

### [Concept 2]

[One paragraph explanation]

### [Concept 3]

[One paragraph explanation]

→ See [GLOSSARY](../../docs/GLOSSARY.md) for complete definitions.

---

## API Overview

<!-- INSTRUCTION:
주요 API의 시그니처만.
상세 문서는 SPEC으로 링크.
-->

### Main Exports

```typescript
// Primary function
function [mainFunction]([params]): [ReturnType];

// Types
type [MainType] = { ... };

// Constants
const [CONSTANT]: [Type];
```

→ See [SPEC.md](./docs/SPEC.md) for complete API reference.

---

## Relationship with Other Packages

<!-- INSTRUCTION:
이 패키지가 다른 패키지와 어떻게 상호작용하는지.
-->

```
┌─────────────┐
│ [Package A] │ ← depends on this
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ THIS PACKAGE│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ [Package B] │ ← this depends on
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@[org]/[dep1]` | Uses [specific API] |
| Used by | `@[org]/[dep2]` | Provides [specific capability] |

---

## When to Use [Package] Directly

<!-- INSTRUCTION:
대부분의 사용자는 상위 패키지를 사용합니다.
직접 사용해야 하는 경우를 명시합니다.
-->

**Most users don't need to use [Package] directly.**

Use [Package] directly when:
- [Use case 1]
- [Use case 2]
- [Use case 3]

For typical usage, see [`@[org]/[higher-level-package]`](../higher-level-package/).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](./docs/GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](./docs/SPEC.md) | Complete specification |
| [FDR.md](./docs/FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
