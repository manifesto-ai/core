# v3 Hard-Cut Execution Roadmap

> Track progress for ADR-009 / ADR-010 / ADR-011 aligned execution.
>
> Owner: Manifesto Core Team  
> Branch: `v3`  
> Last updated: 2026-02-25

## Legend

- `[x]` Done
- `[ ]` Not done
- `[-]` In progress / blocked
- PR = implementation batch

## Summary (Execution Order)

1. Phase 0: ADR/SPEC 정합성 선행 (완료)  
2. Phase 1: ADR-009 (PatchPath 구조 정합화)  
3. Phase 2: ADR-010 (SDK/Runtime 공개 API 하드컷)  
4. Phase 3: ADR-011 (Host Baseline strict enforcement)  
5. Phase 4: 이슈별 검증 테스트 보강  
6. Phase 5: PR 정리 + 이슈 close 근거 정리

---

## PR-A — ADR/SPEC 정렬 (완료 기반)

- [x] ADR-009 상태 수락 처리  
  - File: `docs/internals/adr/009-structured-patch-path.md`
  - Done criteria: `Status: Accepted`

- [x] ADR-010 상태 수락 처리  
  - File: `docs/internals/adr/010-major-hard-cut.md`
  - Done criteria: `Status: Accepted`

- [x] ADR-011 상태 수락 처리  
  - File: `docs/internals/adr/011-host-boundary-reset-and-executionkey-serialization.md`
  - Done criteria: `Status: Accepted`

- [x] ADR 인덱스 상태/노트 동기화  
  - File: `docs/internals/adr/index.md`
  - Done criteria: 009/010/011 항목 상태 반영 + notes 보강

- [x] Spec 인덱스 hard-cut 반영  
  - File: `docs/internals/spec/index.md`
  - Done criteria: ADR-010/011 마이그레이션 현황 반영

---

## PR-B (다음) — ADR-009 PatchPath 작업

- [ ] `PatchPath` 타입 정식 도입 (`PatchSegment` 포함)
  - File targets:
    - `packages/core/src/schema/patch.ts`
    - `packages/compiler/src/lowering/lower-runtime-patch.ts`
    - `packages/core/src/schema/patch.ts` (검증/변환 API)
  - Done criteria:
    - 공개 경로 타입이 string path 중심이 아닌 segment 기반으로 수렴
    - 기존 문자열 path는 parser/legacy 경계에서만 허용

- [ ] `apply`/validator가 segment path를 기준 동작
  - File targets:
    - `packages/core/src/core/apply.ts`
    - `packages/core/src/core/validation-utils.ts`
    - `packages/core/src/core/validator/validator.test.ts`
  - Done criteria:
    - `Unknown patch path` 타입 구분 실패가 구조적 방식으로 해소
    - Record 동적 키 패턴 오류 경로가 예측 가능해짐

- [ ] path 유틸 round-trip 정합성
  - File targets:
    - `packages/core/src/utils/path.ts`
    - `packages/core/src/utils/path.test.ts`
  - Done criteria:
    - dot/colon/slash 등 특수문자 키의 브라켓 노테이션 round-trip pass

- [ ] 회귀 테스트 추가 (`#108`, `#189`)
  - File targets:
    - `packages/core/src/__tests__/apply.test.ts`
    - `packages/core/src/utils/path.test.ts`
  - Done criteria:
    - 특수문자 키 patch roundtrip 케이스
    - Record dynamic key 성공/실패 케이스

---

## PR-C (다음) — ADR-010 API 하드컷

- [ ] 공개 API 레이어 정리(제거/교체)
  - File targets:
    - `packages/sdk/src/index.ts`
    - `packages/sdk/src/create-app.ts`
    - `packages/sdk/src/app.ts`
  - Done criteria:
    - public entry는 `createRuntime` 중심
    - legacy `createApp`, `ManifestoApp` 제거 또는 비공개 전용 이동

- [ ] Runtime 공개 surface 축소/정리
  - File targets:
    - `packages/runtime/src/index.ts`
    - `packages/runtime/src/types/app.ts`
    - `packages/runtime/src/app-runtime.ts`
  - Done criteria:
    - App terminology 노출 범위 최소화
    - execution/host/world 경계가 명확히 분리

- [ ] SDK public export/테스트 갱신
  - File targets:
    - `packages/sdk/src/__tests__/public-exports.test.ts`
    - `packages/sdk/src/__tests__/bootstrap.test.ts`
    - `packages/runtime/src/__tests__/...`
  - Done criteria:
    - `createRuntime`/`RuntimeHandle` 중심 assertion
    - 단일 공개 action API 확인

- [ ] Spec 문서 텍스트 정합성
  - File targets:
    - `packages/sdk/docs/sdk-SPEC-v0.1.0.md`
    - `packages/runtime/docs/runtime-SPEC-v0.1.0.md`
  - Done criteria:
    - ADR-010 반영 상태와 문구 정합

---

## PR-D (보류/진행) — ADR-011 + 이슈 검증

- [x] Host reset canonical-only 적용(코어)
  - File: `packages/host/src/host.ts`
  - Done criteria:
    - `reset`에서 canonical snapshot only 허용
    - `data-only` 입력 reject

- [x] Host bootstrap reset 어댑터 정합성
  - File: `packages/runtime/src/bootstrap/app-bootstrap.ts`
  - Done criteria:
    - runtime 경로에서 canonical 형태 보장

- [x] Host 테스트에 strict baseline 케이스 반영
  - File: `packages/host/src/__tests__/unit/host.test.ts`
  - Done criteria:
    - partial payload reset reject 테스트 보강

- [ ] Host 문서 정합성 최종 반영
  - File:
    - `packages/host/docs/host-SPEC.md`
    - `packages/host/docs/GUIDE.md`
  - Done criteria:
    - full-canonical boundary 규칙 일치

- [ ] 테스트 추가 (#198)
  - File:
    - `packages/host/src/__tests__/unit/host.test.ts`
    - `packages/runtime/src/__tests__/compliance/suite/app-host-executor.spec.ts`
  - Done criteria:
    - data-only baseline rejection + baseline continuity 보호 테스트

---

## PR-E — Issue Validation Pack (테스트 정합성 패스)

- [ ] #108 이슈 재현 + 회귀 test
  - File: `packages/core/src/__tests__/apply.test.ts`

- [ ] #189 이슈 재현 + 회귀 test
  - File: `packages/core/src/__tests__/apply.test.ts`

- [ ] #187 에러 위치/메타 전달 test
  - File: `packages/runtime/src/__tests__/...`

- [ ] #201 테스트 디스커버리 정책 test
  - File: `packages/core/vitest.config.ts`
  - plus optional shared validation test

- [ ] #202 CI gate 일관성 test
  - File: `package.json`
  - plus optional guard test

- [ ] 기존 완료 이슈 회귀 lock 강화
  - File: existing tests in core/sdk/runtime/host/world
  - Keep existing tests for #191/#190/#186/#185/#135/#134

---

## PR-F — Closure & Release

- [ ] PR 단위 분할 정리 (A/B/C/D/E/F)
- [ ] 각 PR에 대한 스코프/근거 요약 작성
- [ ] Issue close comment 템플릿 적용
  - Include: ADR link, test link, migration note

---

## Milestone 상태 체크

- [x] PR-A 준비 완료 (docs + spec 정합성 기본선)
- [ ] PR-B 진행 예정 (core/compiler patch-path)
- [ ] PR-C 진행 예정 (SDK/Runtime hard-cut)
- [ ] PR-D 진행 예정 (ADR-011 + 이슈 테스트)
- [ ] PR-E 진행 예정 (개별 이슈 테스트 증거)
- [ ] PR-F 완료 예정 (이슈 close + release 노트)

## Command Log (for this workspace)

- Current branch: `v3`
- Active work folder: `/Users/eggp/dev/workspace/eggp/manifesto-ai/workspaces/core`

