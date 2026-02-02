# 문서화 작업 워크플로우 템플릿

> **Purpose:** 여러 SPEC에 걸친 변경사항을 체계적으로 문서화하는 작업 템플릿
> **Use When:** ADR 기반의 cross-cutting 변경, 새로운 기능/개념 도입

---

## 1. 문서 유형과 역할

| 유형 | 파일 패턴 | 역할 | 수명 |
|------|----------|------|------|
| **ADR** | `ADR-XXX-<slug>.md` | 결정의 "왜", 대안, 결과 | 영구 (immutable) |
| **SPEC** | `<layer>-SPEC-v<semver>.md` | 규범의 "무엇" | 버전별 갱신 |
| **FDR** | `<layer>-FDR-v<semver>.md` | 설계의 "왜" | 버전별 갱신 |
| **Spec Patch** | `<layer>-SPEC-v<semver>-patch.md` | 변경 diff (작업용) | 머지 후 archive |
| **Migration** | `<layer>-MIGRATION-v<semver>.md` | 사용자 행동 지침 | 버전별 갱신 |

---

## 2. 디렉토리 구조

```
/docs
  ├── adr/                          # 결정 기록 (영구 보관)
  │   ├── ADR-001-layer-separation.md
  │   └── ADR-002-onceIntent-mel-namespace.md
  │
  ├── spec/                         # 규범 문서 (Source of Truth)
  │   ├── core-SPEC-v2.0.0.md
  │   ├── host-SPEC-v2.0.2.md
  │   ├── world-SPEC-v2.0.3.md
  │   ├── mel-SPEC-v0.5.0.md
  │   └── app-SPEC-v2.1.0.md
  │
  ├── fdr/                          # 설계 근거
  │   ├── core-FDR-v2.0.0.md
  │   ├── mel-FDR-v0.5.0.md
  │   └── ...
  │
  ├── migration/                    # 마이그레이션 가이드
  │   └── host-MIGRATION-v2.0.3.md
  │
  ├── learn/                        # 튜토리얼, 예제
  │   └── ...
  │
  └── archive/                      # 작업 완료된 패치 문서
      └── ADR-002-spec-patches.md
```

---

## 3. 작업 워크플로우

### Phase 1: 설계 (Design)

```
┌─────────────────────────────────────────────────────────┐
│  1. ADR 초안 작성                                        │
│     - Context: 왜 변경이 필요한가                         │
│     - Decision: 무엇을 결정했는가                         │
│     - Alternatives: 어떤 대안을 검토했는가                 │
│     - Consequences: 어떤 결과가 예상되는가                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. 영향 범위 식별                                        │
│     - 어떤 SPEC들이 변경되어야 하는가                      │
│     - 어떤 FDR 항목이 추가되어야 하는가                    │
│     - Migration이 필요한가                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. Spec Patches 문서 작성 (작업용 마스터)                 │
│     - 모든 변경사항을 하나의 문서에 정리                    │
│     - 각 SPEC별 Before/After diff 명시                   │
│     - 리뷰어가 전체 그림을 볼 수 있도록                    │
└─────────────────────────────────────────────────────────┘
```

### Phase 2: 리뷰 (Review)

```
┌─────────────────────────────────────────────────────────┐
│  4. ADR + Spec Patches 리뷰                              │
│     - 결정의 타당성 검토                                  │
│     - 변경 범위의 완전성 검토                             │
│     - 문서 간 일관성 검토                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  5. GO / NO-GO 결정                                      │
│     - Blocking issues 해결                               │
│     - ADR Status: Accepted                              │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: 적용 (Apply)

```
┌─────────────────────────────────────────────────────────┐
│  6. 각 SPEC 본문에 변경사항 머지                          │
│     - Patch 파일 → SPEC 본문 반영                        │
│     - 버전 번호 업데이트                                  │
│     - Changelog 추가                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  7. FDR 업데이트                                         │
│     - 새 FDR 항목 추가                                   │
│     - 기존 FDR 참조 링크 업데이트                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  8. Migration 가이드 작성/업데이트                        │
│     - 사용자 행동 지침                                   │
│     - Breaking/Non-breaking 명시                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  9. Cross-reference 추가                                 │
│     - 각 문서에 "See also" 링크                          │
│     - ADR → SPEC, SPEC → FDR 양방향                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  10. Spec Patches → archive/ 이동                        │
│      - 작업 문서는 히스토리로 보관                        │
│      - SPEC 본문이 Source of Truth                      │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 문서 템플릿

### 4.1 ADR 템플릿

```markdown
# ADR-XXX: <Title>

> **Status:** Proposed | Accepted | Deprecated | Superseded
> **Version:** 1.0.0
> **Date:** YYYY-MM-DD
> **Deciders:** <names or teams>
> **Scope:** <affected packages/layers>

---

## Context

### Problem Statement
<왜 변경이 필요한가>

### Current State
<현재 어떻게 동작하는가>

---

## Decision

### D1. <First Decision>
<결정 내용>

### D2. <Second Decision>
<결정 내용>

---

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Option A | ... | ... | ❌ Rejected |
| Option B | ... | ... | ✅ Adopted |

---

## Consequences

### Positive
- ...

### Negative
- ...

### Neutral
- ...

---

## Specification References

| Document | Section | Rules |
|----------|---------|-------|
| <SPEC> | §X.X | <RULE-ID> |

---

## Implementation Checklist

- [ ] <Package>: <Task>
- [ ] Documentation: <Task>

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | YYYY-MM-DD | Initial |
```

### 4.2 Spec Patches 템플릿 (작업용)

```markdown
# ADR-XXX Spec Patches

> **Purpose:** ADR-XXX 구현을 위한 스펙 문서 변경사항 모음
> **Status:** Draft | Ready for Review | Merged
> **Related:** ADR-XXX-<slug>.md

---

## Summary of Changes

| Document | Version Change | Impact |
|----------|----------------|--------|
| <SPEC> | vX.X.X → vX.X.Y | <Breaking/Non-breaking> |

---

## 1. <Layer> SPEC vX.X.X → vX.X.Y

### 1.1 변경 위치: §X.X <Section Name>

**Before:**
```markdown
<기존 내용>
```

**After:**
```markdown
<변경된 내용>
```

### 1.2 Changelog Entry

```markdown
## vX.X.Y (YYYY-MM-DD)

### Added
- ...

### Changed
- ...
```

---

## 2. New FDR Entries

### FDR-<LAYER>-XXX: <Title>

```markdown
# FDR-<LAYER>-XXX: <Title>

## Decision
<결정 내용>

## Context
<배경>

## Rationale
<근거>

## Consequences
<결과>
```

---

## Files to Modify

| Document | Version | Status |
|----------|---------|--------|
| <SPEC> | vX.X.Y | ⬜ Pending |

---

*End of Spec Patches*
```

### 4.3 Migration 템플릿

```markdown
# <Layer> Migration Guide: <Feature> (vX.X.Y)

> **Applies to:** vX.X.X → vX.X.Y
> **Related:** ADR-XXX
> **Date:** YYYY-MM-DD

---

## Overview

<변경 요약>

---

## Step 1: Identify Your Integration Pattern

| Pattern | Description | Migration Effort |
|---------|-------------|------------------|
| Pattern A | ... | ✅ Automatic |
| Pattern B | ... | ⚠️ Manual |

---

## Step 2: Migration by Pattern

### Pattern A: <Name> (Automatic)

<설명>

### Pattern B: <Name> (Manual)

<단계별 가이드>

---

## Step 3: Verify Migration

### Test 1: <Name>
```typescript
// 검증 코드
```

---

## Troubleshooting

### Issue: <Problem>
**Cause:** ...
**Solution:** ...

---

## Version Compatibility Matrix

| Package | Minimum Version | Notes |
|---------|-----------------|-------|
| ... | ... | ... |

---

*End of Migration Guide*
```

---

## 5. 체크리스트

### 변경 시작 전

- [ ] ADR 초안 작성 완료
- [ ] 영향받는 SPEC 목록 식별
- [ ] Spec Patches 문서 생성

### 리뷰 중

- [ ] ADR 상태: Accepted
- [ ] 모든 Spec Patches 리뷰 완료
- [ ] Blocking issues 해결

### 머지 후

- [ ] 각 SPEC 본문에 변경사항 반영
- [ ] 각 SPEC 버전 번호 업데이트
- [ ] 각 SPEC Changelog 추가
- [ ] FDR 항목 추가/업데이트
- [ ] Migration 가이드 작성 (필요시)
- [ ] Cross-reference 링크 추가
- [ ] Spec Patches → archive/ 이동
- [ ] Learn 문서 업데이트 (필요시)

---

## 6. 안티패턴

### ❌ 하지 말 것

| 안티패턴 | 문제점 | 대안 |
|----------|--------|------|
| Patch 파일만 두고 SPEC 미반영 | "진짜 규범이 어디?"라는 혼란 | SPEC 본문에 머지 |
| ADR 없이 SPEC 직접 수정 | "왜 이렇게 바뀌었지?" 추적 불가 | ADR 먼저 작성 |
| FDR 없이 SPEC에 근거 서술 | SPEC이 장황해짐, 역할 혼재 | FDR 분리 |
| 여러 ADR 변경을 하나의 Patch에 | 리뷰/롤백 어려움 | ADR당 하나의 Patch |
| Cross-reference 누락 | 문서 간 네비게이션 불가 | "See also" 필수 |

### ✅ 해야 할 것

| 패턴 | 이유 |
|------|------|
| ADR은 immutable | 결정 히스토리 보존 |
| SPEC이 Source of Truth | 규범은 한 곳에서만 |
| Patch는 작업용, 머지 후 archive | 역할 분리 |
| 버전 번호는 SemVer | 호환성 명시 |

---

## 7. 예시: ADR-002 작업 흐름

```
1. ADR-002 초안 작성
   └→ Context: once() DX 문제
   └→ Decision: onceIntent, $mel
   └→ Alternatives: $host.__compiler, reserved keyword 등

2. 영향 범위 식별
   └→ MEL SPEC, World SPEC, App SPEC, Core SPEC
   └→ FDR-MEL-074~077
   └→ Host Migration

3. ADR-002-spec-patches.md 작성
   └→ 모든 변경사항 diff로 정리

4. 리뷰 → GO

5. 머지
   └→ MEL SPEC v0.5.0 본문 반영
   └→ World SPEC v2.0.3 본문 반영
   └→ App SPEC v2.1.0 본문 반영
   └→ Core SPEC 본문 반영

6. 정리
   └→ ADR-002-spec-patches.md → /archive/
   └→ ADR-002 → /adr/ (영구 보관)
```

---

*End of Template*
