# Runtime SPEC Compliance Test Suite (Draft)

이 문서는 `runtime-SPEC-v0.1.0.md`의 규칙을 검증하기 위한 런타임 레이어 컴플라이언스 스위트 매핑입니다.

## Scope

- 대상: `packages/runtime` 내부 실행 오케스트레이션 레이어
- 목표: 현재 이슈에서 드러난 Runtime/Host 경계 정합성(특히 기본값 materialization 전달)을 우선 점검
- 타입: 직접 실행 stage 단위 테스트 + HostExecutor bridge 단위 테스트

## Coverage Map (MVP)

| SPEC ID | 요구사항 | 테스트 | 상태 |
|---------|----------|--------|------|
| RT-LC-3 | Genesis snapshot includes schema defaults and evaluated computed values | `__tests__/compliance/suite/bootstrap-defaults.spec.ts` | Added |
| RT-HEXEC-1 | Runtime → HostExecutor execution request uses stage inputs including base snapshot | `__tests__/compliance/suite/execute-host.spec.ts` | Added |
| RT-HEXEC-2 | execute() fallback when World restore fails | `__tests__/compliance/suite/execute-host.spec.ts` | Added |
| RT-HEXEC-3 | Execution result is reported as HostExecutionResult contract | `__tests__/compliance/suite/app-host-executor.spec.ts` | Added |
| RT-HEXEC-4 | executionKey must be used as Host routing intentId | `__tests__/compliance/suite/app-host-executor.spec.ts` | Added |

## Why these first

- 현재 #185/#190 이슈는 Runtime에서 복구한 `baseSnapshot`이 Host 실행 시작점으로 정확히 반영되지 않을 때 드러납니다.
- `AppHostExecutor`/`executeHost` 계층이 이 경계에서 동작을 보장하는지 검증해야 향후 유실 재발을 막을 수 있습니다.

## Planned expansion

- RT-QUEUE-1~4 (ExecutionKey 라우팅/동시성)
- RT-PUB-1~5 (state:publish tick 경계)
- RT-INV-* (invariant + determinism)
