# Architecture

<!-- INSTRUCTION:
이 문서는 "전체 정신모델"을 고정하는 문서입니다.
한 번 작성하면 거의 바뀌지 않아야 합니다.
구현 디테일이 아닌 "개념적 구조"를 설명합니다.
-->

> **Status:** Stable  
> **Last Updated:** [DATE]

---

## Overview

<!-- INSTRUCTION:
전체 시스템을 한 문단으로 요약합니다.
-->

[PROJECT_NAME] is structured as [ARCHITECTURAL_PATTERN]. This document explains the conceptual model, layer responsibilities, and data flow that govern the entire system.

---

## Guiding Principles

<!-- INSTRUCTION:
시스템 전체를 관통하는 원칙들.
이것들이 왜 중요한지 한 줄씩 설명.
-->

| Principle | Why It Matters |
|-----------|----------------|
| **[Principle 1]** | [Consequence if violated] |
| **[Principle 2]** | [Consequence if violated] |
| **[Principle 3]** | [Consequence if violated] |

---

## Layer Model

<!-- INSTRUCTION:
계층 구조를 시각적으로 표현합니다.
각 계층의 책임을 명확히.
-->

```
┌─────────────────────────────────────────────────────────────────┐
│                         [TOP_LAYER]                             │
│  Responsibility: [WHAT_IT_DOES]                                 │
│  Owns: [WHAT_IT_OWNS]                                           │
│  Never: [WHAT_IT_NEVER_DOES]                                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │ [INTERFACE_DESCRIPTION]
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        [MIDDLE_LAYER]                           │
│  Responsibility: [WHAT_IT_DOES]                                 │
│  Owns: [WHAT_IT_OWNS]                                           │
│  Never: [WHAT_IT_NEVER_DOES]                                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │ [INTERFACE_DESCRIPTION]
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        [BOTTOM_LAYER]                           │
│  Responsibility: [WHAT_IT_DOES]                                 │
│  Owns: [WHAT_IT_OWNS]                                           │
│  Never: [WHAT_IT_NEVER_DOES]                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities Matrix

| Layer | Does | Does NOT |
|-------|------|----------|
| **[Layer1]** | [Responsibility] | [Anti-responsibility] |
| **[Layer2]** | [Responsibility] | [Anti-responsibility] |
| **[Layer3]** | [Responsibility] | [Anti-responsibility] |

---

## Data Flow

<!-- INSTRUCTION:
데이터가 시스템을 통해 어떻게 흐르는지.
주요 흐름을 시퀀스로 설명.
-->

### Primary Flow: [FLOW_NAME]

```
[ACTOR] ─────┐
             │ 1. [ACTION]
             ▼
        ┌─────────┐
        │ [COMP1] │ 2. [TRANSFORMATION]
        └────┬────┘
             │
             ▼
        ┌─────────┐
        │ [COMP2] │ 3. [TRANSFORMATION]
        └────┬────┘
             │
             ▼
        [RESULT]
```

**Step-by-step:**

1. **[Step 1]**: [Description]
2. **[Step 2]**: [Description]
3. **[Step 3]**: [Description]

### Secondary Flow: [FLOW_NAME]

<!-- INSTRUCTION:
다른 중요한 흐름이 있다면 추가.
-->

[Similar structure]

---

## Component Interactions

<!-- INSTRUCTION:
주요 컴포넌트 간의 관계.
"누가 누구를 알고 있는가"를 명확히.
-->

```
┌──────────┐     knows     ┌──────────┐
│ [Comp A] │──────────────▶│ [Comp B] │
└──────────┘               └──────────┘
     │                          │
     │ creates                  │ uses
     ▼                          ▼
┌──────────┐               ┌──────────┐
│ [Comp C] │               │ [Comp D] │
└──────────┘               └──────────┘
```

| Component | Knows About | Created By | Consumed By |
|-----------|-------------|------------|-------------|
| [Comp A] | [Dependencies] | [Creator] | [Consumers] |
| [Comp B] | [Dependencies] | [Creator] | [Consumers] |

---

## Key Abstractions

<!-- INSTRUCTION:
시스템의 핵심 추상화 개념들.
각각이 무엇을 표현하는지.
-->

### [Abstraction 1]

**What it represents:** [Description]

**Why it exists:** [Rationale]

**Invariants:**
- [Invariant 1]
- [Invariant 2]

### [Abstraction 2]

[Same structure]

---

## Boundaries & Contracts

<!-- INSTRUCTION:
레이어/컴포넌트 간 경계에서의 계약.
무엇이 허용되고 무엇이 금지되는지.
-->

### [Boundary Name]: [Layer A] ↔ [Layer B]

| Direction | Allowed | Forbidden |
|-----------|---------|-----------|
| A → B | [What A can send to B] | [What A must never send] |
| B → A | [What B can return to A] | [What B must never return] |

**Contract:**
- [Rule 1]
- [Rule 2]

---

## Why Not [Alternative Approach]?

<!-- INSTRUCTION:
사람들이 "왜 X 방식 안 썼어?"라고 물을 만한 것들.
간결하게 답변.
상세 근거는 FDR로 링크.
-->

| Alternative | Why Not |
|-------------|---------|
| [Alternative 1] | [Brief reason] → See [FDR-XXX](link) |
| [Alternative 2] | [Brief reason] → See [FDR-XXX](link) |
| [Alternative 3] | [Brief reason] → See [FDR-XXX](link) |

---

## Extension Points

<!-- INSTRUCTION:
시스템을 확장할 수 있는 지점들.
미래 버전에서 어떻게 진화할 수 있는지.
-->

| Extension Point | What Can Be Extended | Current Status |
|-----------------|---------------------|----------------|
| [Point 1] | [Description] | v1.0: [Status] |
| [Point 2] | [Description] | v1.0: [Status] |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [GLOSSARY.md](./GLOSSARY.md) | Term definitions |
| [Core SPEC](./packages/core/SPEC.md) | Core layer specification |
| [Host FDR](./packages/host/FDR.md) | Host design rationale |

---

*End of Architecture Document*
