# Manifesto Friction Log — TaskFlow v2 Rebuild

> This document records real implementation friction discovered while rebuilding
> TaskFlow on top of `@manifesto-ai/sdk`.

This file is more important than the demo app itself.

## Logging Rules

1. Record friction immediately after applying the workaround.
2. Copy exact error output when available.
3. Add a `// FRICTION: F-XXX` comment in workaround code when the workaround remains in source.
4. Do not log speculation as a confirmed issue. Use the seed checklist below until it is reproduced.
5. At the end of each phase, summarize blocker and major patterns before continuing.

## Seed Checks To Validate Early

- [ ] `.mel` import and loader strategy in Next.js is concrete and documented.
- [ ] `createManifesto({ schema: melString })` and imported `.mel` both behave as expected.
- [ ] `dispatchAsync` helper boilerplate is acceptable, or its friction is documented.
- [ ] `getSnapshot().data` and `snapshot.computed[...]` type ergonomics are assessed.
- [ ] Compiler diagnostics for `filter`, `$item`, nullable fields, and object literals are captured if they fail.
- [ ] Any SDK/SPEC drift encountered during setup is documented with exact observed behavior.

## Issue Template

Copy this block for each confirmed issue.

```markdown
## F-001: [One-line title]

- **카테고리**: MEL 표현력 | SDK API | SPEC-구현 괴리 | DX | 에러 메시지 | 문서 | 타입 시스템 | 성능
- **심각도**: blocker | major | minor | papercut
- **발견 시점**: Phase N, [작업 항목]
- **재현 경로**: [어떤 코드를 작성하려다가 막혔는지]

### 기대한 것
[SPEC이나 문서에 따르면 이렇게 되어야 했다]

### 실제 동작
[실제로는 이렇게 됐다. 에러 메시지가 있다면 전문 포함]

### Workaround
[우회한 방법. 코드 포함]

### 근본 원인 추정
[왜 이런 문제가 생겼는지에 대한 추정]

### Manifesto에 대한 제안
[프레임워크 레벨에서 어떻게 해결해야 하는지]

---
```

## Confirmed Issues

No confirmed rebuild friction has been logged yet.

## Phase Summaries

### Phase 1 Summary

Pending.

### Phase 2 Summary

Pending.

### Phase 3 Summary

Pending.

### Phase 4 Summary

Pending.
