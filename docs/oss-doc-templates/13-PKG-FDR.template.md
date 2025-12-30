# [Package] — Foundational Design Rationale (FDR)

<!-- INSTRUCTION:
FDR은 "왜 이렇게 결정했는가"를 기록하는 역사적 문서입니다.
- 결정(Decision)이 명확해야 함
- 맥락(Context)이 있어야 함
- 거부된 대안(Alternatives Rejected)이 있어야 함
- 결과(Consequences)가 명시되어야 함

FDR은 거의 수정하지 않습니다.
결정이 바뀌면 새 FDR을 만들고 이전 FDR은 "Superseded"로 표시합니다.
-->

> **Version:** [X.Y]  
> **Status:** Normative  
> **Purpose:** Document the "Why" behind every constitutional decision in [Package]

---

## Overview

This document records the foundational design decisions that shape [Package].

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why rejected
- **Consequences**: What this decision enables and constrains

---

## FDR-[XX]001: [Decision Title]

<!-- INSTRUCTION:
각 FDR 항목의 표준 형식입니다.
-->

### Decision

<!-- INSTRUCTION:
결정 자체를 명확하게.
"우리는 X를 Y로 결정했다" 형식.
-->

[Clear statement of the decision]

```
[Optional: concise code/diagram illustrating the decision]
```

### Context

<!-- INSTRUCTION:
이 결정이 필요했던 배경.
어떤 문제/상황이 있었는가?
-->

[Why this decision was needed. What problem or situation prompted it?]

### Rationale

<!-- INSTRUCTION:
왜 이 결정이 옳은가?
어떤 이점이 있는가?
-->

**[Core principle or insight]**

| Concern | Why This Decision |
|---------|-------------------|
| **[Concern 1]** | [How the decision addresses it] |
| **[Concern 2]** | [How the decision addresses it] |
| **[Concern 3]** | [How the decision addresses it] |

[Additional explanation if needed]

### Alternatives Rejected

<!-- INSTRUCTION:
고려했지만 거부한 대안들.
왜 거부했는지 명확히.
-->

| Alternative | Why Rejected |
|-------------|--------------|
| [Alternative 1] | [Reason for rejection] |
| [Alternative 2] | [Reason for rejection] |
| [Alternative 3] | [Reason for rejection] |

### Consequences

<!-- INSTRUCTION:
이 결정의 결과.
무엇이 가능해지고, 무엇이 제약되는가?
-->

**Enables:**
- [What becomes possible]
- [What becomes easier]

**Constrains:**
- [What becomes impossible]
- [What becomes harder]

**Requires:**
- [What must be done as a result]
- [What invariants must be maintained]

---

## FDR-[XX]002: [Decision Title]

### Decision

[Decision statement]

### Context

[Background and problem]

### Rationale

[Why this is the right choice]

| Concern | Why This Decision |
|---------|-------------------|
| **[Concern]** | [Reason] |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| [Alt] | [Reason] |

### Consequences

- [Consequence 1]
- [Consequence 2]

---

## FDR-[XX]003: [Decision Title]

[Same structure]

---

## FDR-[XX]004: [Decision Title]

[Same structure]

---

## FDR-[XX]005: [Decision Title]

[Same structure]

---

<!-- INSTRUCTION:
더 많은 FDR 항목을 필요한 만큼 추가합니다.
-->

---

## Summary Table

<!-- INSTRUCTION:
모든 FDR의 빠른 참조 테이블.
-->

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| [XX]001 | [Short description] | [Core principle] |
| [XX]002 | [Short description] | [Core principle] |
| [XX]003 | [Short description] | [Core principle] |
| [XX]004 | [Short description] | [Core principle] |
| [XX]005 | [Short description] | [Core principle] |

---

## Cross-Reference

### Related SPECs

<!-- INSTRUCTION:
이 FDR들이 어떤 SPEC의 근거가 되는지.
-->

| SPEC Section | Relevant FDR |
|--------------|--------------|
| [SPEC Section X] | FDR-[XX]001, FDR-[XX]003 |
| [SPEC Section Y] | FDR-[XX]002 |

### Related FDRs in Other Packages

<!-- INSTRUCTION:
다른 패키지의 FDR과의 관계.
-->

| Other FDR | Relationship |
|-----------|--------------|
| [Other Package] FDR-[YY]001 | [How they relate] |
| [Other Package] FDR-[ZZ]003 | [How they relate] |

---

## Superseded Decisions

<!-- INSTRUCTION:
과거에 내렸다가 바뀐 결정들.
역사 기록으로 유지합니다.
-->

### FDR-[XX]000 (Superseded by FDR-[XX]005)

> **Status:** Superseded  
> **Superseded by:** FDR-[XX]005  
> **Date:** [When superseded]

**Original Decision:** [What was originally decided]

**Why Changed:** [Why the decision was revisited]

---

## Appendix: Decision Timeline

<!-- INSTRUCTION:
결정이 언제 내려졌는지 시간순 기록.
선택 섹션.
-->

| Date | FDR | Decision |
|------|-----|----------|
| [Date] | FDR-[XX]001 | [Decision] |
| [Date] | FDR-[XX]002 | [Decision] |
| [Date] | FDR-[XX]003 | [Decision] |

---

*End of [Package] FDR*
