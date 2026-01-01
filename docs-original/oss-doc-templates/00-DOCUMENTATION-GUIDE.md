# Manifesto Documentation Templates Guide

> 이 가이드는 OSS 급 문서화를 위한 템플릿 사용법을 설명합니다.

---

## 문서 타입 4분류

| 타입 | 파일명 | 질문 | 대상 | 변경 빈도 |
|------|--------|------|------|-----------|
| **README** | `README.md` | "이게 뭐고 왜 써?" | 신규 사용자 | 낮음 |
| **GUIDE** | `GUIDE.md` | "어떻게 써?" | 실사용자 | 중간 |
| **SPEC** | `SPEC.md` | "뭘 보장해?" | 구현자/리뷰어 | 매우 낮음 |
| **FDR** | `FDR.md` | "왜 이렇게 됐어?" | 기여자/연구자 | 거의 없음 |

---

## 핵심 원칙

### 1. 역할 분리 (절대 원칙)

```
❌ README에 SPEC/FDR 섞지 않는다
❌ GUIDE에 철학을 넣지 않는다
❌ SPEC에 튜토리얼을 넣지 않는다
❌ FDR에 API 레퍼런스를 넣지 않는다
```

### 2. "이게 아닌 것" 명시 (Manifesto 필수)

모든 README와 SPEC에는 반드시 "What This Is NOT" 또는 "Non-Goals" 섹션이 있어야 합니다.

Manifesto는 기존 AI Agent 프레임워크와 근본적으로 다르기 때문에, 오해 방지가 필수입니다.

### 3. 복붙 가능한 코드

GUIDE에는 반드시 복사해서 바로 실행할 수 있는 코드가 있어야 합니다.

```typescript
// ✅ 좋은 예: 완전한 실행 가능 코드
import { createCore } from '@manifesto-ai/core';

const core = createCore(schema);
const result = core.compute(snapshot, intent);
console.log(result.status);

// ❌ 나쁜 예: 컨텍스트 없는 조각
core.compute(snapshot, intent);
```

---

## 디렉토리 구조

```
manifesto/
├── README.md                 ← 최상위 랜딩
├── docs/
│   ├── ARCHITECTURE.md       ← 전체 정신모델
│   ├── GOVERNANCE.md         ← 기여/변경 프로세스
│   ├── GLOSSARY.md           ← 용어 정의
│   └── FAQ.md                ← 자주 묻는 질문
│
├── packages/
│   ├── core/
│   │   ├── README.md         ← Core 소개 (패키지 루트)
│   │   └── docs/
│   │       ├── GUIDE.md      ← Core 사용법
│   │       ├── SPEC.md       ← Core 명세
│   │       └── FDR.md        ← Core 설계 근거
│   │
│   ├── host/
│   │   ├── README.md
│   │   └── docs/
│   │       ├── GUIDE.md
│   │       ├── SPEC.md
│   │       └── FDR.md
│   │
│   └── ... (다른 패키지들)
│
└── examples/
    ├── minimal/              ← 최소 동작 예제
    ├── todo-app/             ← 기본 앱 예제
    └── hitl-demo/            ← HITL 예제
```

> **정책:** 각 패키지의 문서(GUIDE, SPEC, FDR)는 해당 패키지의 `docs/` 폴더에 위치합니다.
> README.md는 패키지 루트에 위치합니다.

---

## 템플릿 파일 목록

### 최상위 레포지토리용
- `01-ROOT-README.template.md` — 랜딩 페이지
- `02-ARCHITECTURE.template.md` — 전체 아키텍처
- `03-GOVERNANCE.template.md` — 기여 가이드
- `04-GLOSSARY.template.md` — 용어 사전
- `05-FAQ.template.md` — FAQ

### 패키지용
- `10-PKG-README.template.md` — 패키지 소개
- `11-PKG-GUIDE.template.md` — 사용 가이드
- `12-PKG-SPEC.template.md` — 명세
- `13-PKG-FDR.template.md` — 설계 근거

---

## 작성 순서 권장

```
Phase 1: 온보딩 경로 확보
  1. 최상위 README.md
  2. 각 패키지 README.md
  3. Core GUIDE.md (첫 5분 경험)

Phase 2: 심화 문서
  4. 나머지 패키지 GUIDE.md
  5. GLOSSARY.md
  6. FAQ.md

Phase 3: 명세/근거
  7. 각 패키지 SPEC.md
  8. 각 패키지 FDR.md
  9. ARCHITECTURE.md
  10. GOVERNANCE.md
```

---

## 품질 체크리스트

### README 체크
- [ ] 5초 안에 "이게 뭔지" 알 수 있는가?
- [ ] 30초 안에 "왜 쓰는지" 알 수 있는가?
- [ ] "이게 아닌 것"이 명확한가?
- [ ] Quick Start 링크가 있는가?

### GUIDE 체크
- [ ] 복붙해서 바로 실행되는 코드가 있는가?
- [ ] 흔한 실수가 문서화되어 있는가?
- [ ] 단계별로 따라할 수 있는가?
- [ ] 철학 설명 없이 "방법"만 있는가?

### SPEC 체크
- [ ] MUST/SHOULD/MAY가 명확한가?
- [ ] 모든 타입이 정의되어 있는가?
- [ ] Invariant가 명시되어 있는가?
- [ ] 구현자가 이것만 보고 구현할 수 있는가?

### FDR 체크
- [ ] 결정(Decision)이 명확한가?
- [ ] 맥락(Context)이 있는가?
- [ ] 거부된 대안(Alternatives Rejected)이 있는가?
- [ ] 결과(Consequences)가 명시되어 있는가?

---

## RFC 2119 키워드 사용법

SPEC 문서에서는 RFC 2119 키워드를 사용합니다:

| 키워드 | 의미 | 사용 예 |
|--------|------|---------|
| **MUST** | 절대적 필수 | "Host MUST clear requirements" |
| **MUST NOT** | 절대적 금지 | "Core MUST NOT perform IO" |
| **SHOULD** | 강력 권장 | "Handlers SHOULD return within 5s" |
| **SHOULD NOT** | 강력 비권장 | "Flow SHOULD NOT have side effects" |
| **MAY** | 선택적 | "Host MAY batch patches" |

---

## 템플릿 사용 시 주의사항

1. **`<!-- INSTRUCTION: ... -->`** 주석은 작성 가이드입니다. 최종 문서에서 삭제하세요.
2. **`[PLACEHOLDER]`** 는 실제 내용으로 교체하세요.
3. **예시 텍스트**는 Manifesto 맥락에 맞게 수정하세요.
4. **섹션 순서**는 가급적 유지하세요. 일관성이 중요합니다.

---

*End of Documentation Guide*
