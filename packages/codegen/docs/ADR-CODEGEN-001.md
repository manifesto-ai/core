# ADR-CODEGEN-001: Plugin-Based Codegen Targets for Manifesto Domains

> **Status:** Accepted
> **Version:** 0.3.1
> **Date:** 2026-02-05
> **Deciders:** Manifesto Architecture Team
> **Scope:** `@manifesto-ai/codegen` (build-time tooling)
> **Depends On:** Core SPEC v2.x (`DomainSchema`), MEL SPEC v0.5.x (`compileMelDomain()` output), ADR-001 (Layer Separation)
> **Related:** Host Contract v2.x (Host boundary validation), App SPEC v2.x (platform namespaces)

---

## 1. Context

Manifesto는 Domain을 선언(DSL/IR)로 정의하고, 런타임은 Host boundary에서 검증하며, 실행은 App → Proposal → Authority → World 경로로만 일어나도록 설계되어 있다.

ProofFlow 등 실제 앱 구현에서 다음 요구가 반복적으로 발생한다:

1. **타입 공유**: Domain 타입을 TypeScript 타입(interfaces/type aliases)로 export하여 UI/Host/Tooling에서 재사용
2. **런타임 검증**: Host boundary에서 Zod(또는 다른 validator)로 Domain 객체를 검증
3. **Drift 제거**: MEL/DomainSchema 타입 변경 시 타입 정의와 validator가 자동 동기화
4. **확장성**: Zod/TS 외에도 JSON Schema, OpenAPI, Rust/Python 타입, 문서 생성 등 타겟 확장 가능
5. **레이어/의존성 분리**: compiler core는 언어/런타임 중립성을 유지해야 하며, 특정 생태계(Zod/TS)에 종속 금지

따라서 `DomainSchema`를 입력으로 하는 독립적 코드 생성 도구가 필요하다.

---

## 2. Decision

### 2.1 `@manifesto-ai/codegen`을 consumer tool로 도입

- `@manifesto-ai/compiler`는 MEL → `DomainSchema`(Core IR) 생성까지 책임진다.
- `@manifesto-ai/codegen`은 `DomainSchema`를 입력으로 받아 다양한 타겟 산출물을 생성한다.
- compiler에 codegen 기능을 내장하지 않는다.

### 2.2 Plugin 주입 모델

- `@manifesto-ai/codegen`은 "타겟별 생성기"를 플러그인으로 주입받는다.
- 코어는 플러그인 실행(배열 순서대로) / FilePatch 합성 / 충돌 검사 / 파일 쓰기만 담당한다.
- 타겟 구현(예: TS 타입 생성, Zod 생성)은 별도 패키지 플러그인으로 분리한다.

예시 플러그인 패키지:

- `@manifesto-ai/codegen-plugin-ts`
- `@manifesto-ai/codegen-plugin-zod`
- (미래) `@manifesto-ai/codegen-plugin-jsonschema`, `...-docs`, `...-openapi`

### 2.3 입력은 `DomainSchema` 기본

- 기본 입력: `DomainSchema` (정규화된 IR)
- 선택 입력(옵션): `sourceId`(파일 경로), 원본 MEL 텍스트 등은 부가 메타데이터로만 취급

### 2.4 Zod의 "구조 생성"과 "refine(의미 검증)" 분리

- **자동 생성 (base)**: Shape / nullable / union / record / array / `z.lazy()` for circular refs
- **수동 작성 (refine overlay)**: Acyclic 검사, referential integrity, Lean-specific checks 등

### 2.5 결정성(determinism)과 재생성 검증을 1급 목표

- 입력이 같으면 출력이 항상 동일 (정렬, 순서 고정, 포매팅 미포함)
- 생성물은 커밋하고, CI에서 `generate && git diff --exit-code`로 freshness 검증

### 2.6 DomainSchema 동기화 전략

- codegen은 `@manifesto-ai/core`를 **peerDependency**로 선언 (실제 `DomainSchema` 타입만 import)
- Core의 `DomainSchema` 변경은 semver minor/major로 표현
- codegen은 **지원하는 Core 버전 범위**를 `peerDependencies`에 명시
- `TypeDefinition.kind`에 새 variant 추가 대비: 모든 플러그인은 **unknown kind fallback** (`unknown` 타입 emit + warning) 필수 구현
- Core 레포에 `DomainSchema` 변경 시 **자동 이슈 생성** (GitHub Actions cross-repo dispatch)으로 추적

**Freeze 기준**: `DomainSchema`의 `TypeDefinition` 합타입이 semver major로 안정화된 이후에만 넓은 범위(예: `^2.0.0`) 설정. 그 전까지는 pin 전략(`~2.0.x`) 사용.

---

## 3. Detailed Design

### 3.1 Plugin Interface

MVP 단계에서는 최소 인터페이스만 정의. Lifecycle hook(`buildStart`/`buildEnd`)과 ordering 메커니즘(`enforce`)은 실제 필요 발생 시 추가.

```typescript
export interface CodegenPlugin {
  /** 플러그인 이름. artifacts 네임스페이스 키로도 사용. */
  name: string;

  /**
   * DomainSchema로부터 FilePatch를 생성.
   * 플러그인 배열의 순서가 곧 실행 순서.
   */
  generate: (ctx: CodegenContext) => CodegenOutput | Promise<CodegenOutput>;
}

export interface CodegenContext {
  readonly schema: DomainSchema;
  readonly sourceId?: string;
  readonly outDir: string;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly helpers: {
    stableHash(input: unknown): string;
  };
}

export interface CodegenOutput {
  patches: FilePatch[];
  artifacts?: Record<string, unknown>;
}
```

**설계 근거 — 제외 항목:**

| 제외 항목 | 사유 | 도입 조건 |
|-----------|------|-----------|
| `enforce?: "pre" \| "post"` | 1st-party 플러그인 2~3개 수준에서 배열 순서로 충분 | 서드파티 생태계 형성 시 |
| `buildStart` / `buildEnd` | codegen은 stateless 변환. lifecycle 필요 시나리오 미존재 | 캐싱, incremental build 도입 시 |
| `helpers.formatTs` | 결정성 목표와 충돌. 포매팅은 소비자의 lint/format 파이프라인 책임 | 제외 (영구) |
| `supports()` | 모든 플러그인이 DomainSchema를 처리하므로 필터 불필요 | 다른 IR 타입 지원 시 |

### 3.2 FilePatch Model

플러그인의 출력을 Manifesto의 Patch 메커니즘과 동일한 사고 모델로 설계. 플러그인은 "최종 파일"이 아니라 "파일에 대한 연산"을 선언하고, runner가 virtual FS 위에서 합성.

```typescript
export type FilePatch =
  | { op: "set"; path: string; content: string }    // 파일 생성/덮어쓰기
  | { op: "delete"; path: string };                  // 파일 삭제

// path는 outDir 기준 상대 경로
```

**왜 FilePatch인가:**

- **충돌 감지**: 같은 path에 `set` 2번이면 runner가 즉시 error
- **플러그인 조합**: patch 합성으로 설명 가능 — Manifesto apply/patch와 동일 mental model
- **incremental/캐시 확장**: 해시 기반 변경 감지를 나중에 깔끔하게 부착 가능
- **delete 연산**: 도메인에서 타입 제거 시 고아 파일 정리 가능

### 3.3 Runner: FilePatch 합성 규칙

```typescript
export async function generate(opts: {
  schema: DomainSchema;
  outDir: string;
  plugins: CodegenPlugin[];
}): Promise<GenerateResult> { /* ... */ }
```

Runner 실행 흐름:

1. 빈 virtual FS와 빈 artifacts `{}` 로 시작
2. 각 플러그인을 배열 순서대로 실행:
   - `ctx.artifacts`에 이전까지의 누적 artifacts 전달
   - 플러그인이 반환한 `patches`를 virtual FS에 순차 적용
   - 플러그인이 반환한 `artifacts`를 `allArtifacts[plugin.name]`에 배치
3. virtual FS를 disk에 flush

**FilePatch 충돌 규칙:**

| 상황 | 기본 동작 | 근거 |
|------|-----------|------|
| 같은 path에 `set` 2회 (동일 플러그인 내) | **error** | 플러그인 내부 버그 |
| 같은 path에 `set` 2회 (서로 다른 플러그인) | **error** | 조용한 덮어쓰기는 디버깅 지옥 |
| `delete` 후 `set` (순서대로) | **허용** | 의도적 재생성 |
| `set` 후 `delete` (순서대로) | **허용** + `Diagnostic.warn` | 이전 플러그인 작업 무효화 경고 |
| 존재하지 않는 path에 `delete` | **warn** | 무해하지만 의도하지 않은 상황 |

```typescript
export interface GenerateResult {
  files: Array<{ path: string; content: string }>;
  artifacts: Record<string, unknown>;
  diagnostics: Diagnostic[];
}

export interface Diagnostic {
  level: "warn" | "error";
  plugin: string;
  message: string;
}
```

### 3.4 Runner Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RUNNER-OUTDIR-1 | MUST | Runner MUST guarantee stale file removal. Strategy: **clean-before-generate** — runner deletes all files in `outDir` before writing. Safe because `outDir` is generated-only; handwritten files (e.g., `refine.ts`) MUST reside outside `outDir`. |
| RUNNER-PLUGIN-1 | MUST | `plugin.name` MUST be unique within a `generate()` invocation. Runner MUST validate at startup and throw on duplicates (since `name` is the artifacts namespace key). |
| FILEPATCH-1 | MUST | `patch.path` MUST be POSIX-normalized relative path (`/` separator). Absolute paths, `..` traversal, drive letters, null bytes, and any path escaping `outDir` MUST be rejected. Runner normalizes internally to `/`; OS-specific conversion at disk write only. |
| FILEPATCH-2 | SHOULD | `patch.path` SHOULD be case-sensitive regardless of host OS, for cross-platform determinism. |

### 3.5 Artifacts Pipeline

플러그인 간 데이터 전달은 artifacts의 네임스페이스 격리:

```typescript
// TS 플러그인이 생성하는 artifacts
// runner가 자동으로 artifacts["codegen-plugin-ts"]에 배치
{
  artifacts: {
    typeNames: ["ProofNode", "ProofTree", "FileState"],
    typeImportPath: "../schema/generated/types",
  }
}

// Zod 플러그인이 TS artifacts를 참조
generate(ctx) {
  const tsArtifacts = ctx.artifacts["codegen-plugin-ts"] as TsPluginArtifacts | undefined;

  if (tsArtifacts) {
    // z.ZodType<ProofNode> 어노테이션 생성 가능
    const typeImport = tsArtifacts.typeImportPath;
  } else {
    // TS 플러그인 없이도 독립 동작 (타입 어노테이션 생략)
  }
}
```

**규칙:**

- 각 플러그인의 artifacts는 `artifacts[plugin.name]`에 자동 격리. 다른 네임스페이스에 쓸 수 없음
- artifacts 스키마는 플러그인이 자체 정의/export (예: `TsPluginArtifacts` 타입)
- 다음 플러그인은 이전 플러그인의 artifacts를 **optional**로 참조. 없으면 graceful degrade

### 3.6 TypeDefinition → TS 매핑 (TS Plugin)

| `TypeDefinition.kind` | TypeScript 출력 | 비고 |
|------------------------|-----------------|------|
| `"primitive"` | `string`, `number`, `boolean`, `null` | 직접 매핑 |
| `"literal"` | `"foo"`, `42`, `true`, `null` | 리터럴 타입 |
| `"array"` | `T[]` | element 재귀 |
| `"record"` | `Record<K, V>` | key/value 재귀 |
| `"object"` | `interface` (named) 또는 inline `{ ... }` | optional → `?` |
| `"union"` | `T1 \| T2 \| ...` | |
| `"ref"` | 이름 참조 | 순환 가능 → `interface` 필수 |
| *unknown* | `unknown` + `Diagnostic` emit | Core 진화 대비 fallback |

**Nullable 정책**: `T | null` (null-only). `undefined` 미사용.

**Named type 출력 규칙**:
- `"object"` kind의 top-level named type → `export interface`
- 그 외 named type → `export type`
- `"ref"` kind를 포함하는 타입은 반드시 `interface`로 선언 (TS 순환 참조 해결)

### 3.7 TypeDefinition → Zod 매핑 (Zod Plugin)

| `TypeDefinition.kind` | Zod 출력 | 비고 |
|------------------------|----------|------|
| `"primitive"` | `z.string()`, `z.number()`, etc. | |
| `"literal"` | `z.literal(...)` | |
| `"array"` | `z.array(...)` | |
| `"record"` | `z.record(...)` | |
| `"object"` | `z.object({ ... })` | optional → `.optional()` |
| `"union"` | `z.union([...])` | 2-variant `T \| null` → `z.nullable(T)` 최적화 |
| `"ref"` | `z.lazy(() => XSchema)` | **순환 참조 필수 처리** |
| *unknown* | `z.unknown()` + `Diagnostic` emit | |

**TS 타입 연결**: Zod 플러그인은 TS 플러그인의 artifacts에서 타입 이름/import 경로를 참조하여 `z.ZodType<T>` 어노테이션 생성. TS 플러그인 없으면 어노테이션 생략 후 독립 동작.

```typescript
// 생성 예시: base.ts (TS 플러그인 artifacts 사용 시)
import type { ProofNode } from '../../schema/generated/types';

export const ProofNodeSchema: z.ZodType<ProofNode> = z.object({
  id: z.string(),
  dependencies: z.array(z.lazy(() => ProofNodeSchema)),  // circular ref
});
```

### 3.8 생성 범위와 StateSpec 한계

| DomainSchema 필드 | TS 타입 생성 | Zod 스키마 생성 | 근거 |
|-------------------|-------------|----------------|------|
| `types` (TypeSpec) | ✅ 1차 대상 | ✅ | 명시적 named types — codegen의 핵심 입력 |
| `state` (StateSpec) | ⚠️ best-effort | ⚠️ best-effort | 표현력 한계 있음 (아래 참조) |
| `computed` (ComputedSpec) | ❌ (MVP 제외) | ❌ (Core가 계산, 외부 검증 불필요) | computed 결과 타입 추론은 Expr 기반 타입 추론기 필요 — MVP 범위 밖 |
| `actions` (ActionSpec) | ✅ (action input 타입) | ✅ (입력 검증) | action input은 외부에서 유입 |
| `meta` | ❌ | ❌ | 빌드 메타데이터, 런타임 불필요 |

**StateSpec 타입 생성의 표현력 한계:**

Core SPEC의 `StateSpec` / `FieldType`는 의도적으로 단순하게 설계. 결과적으로 MEL에서 자주 사용하는 다음 패턴들은 `StateSpec`만으로 정확한 타입 생성 불가:

| MEL 패턴 | StateSpec 표현 | codegen 출력 | 문제 |
|----------|---------------|-------------|------|
| `files: Record<FileUri, FileState>` | `type: "object"` (fields 없음) | `Record<string, unknown>` | value 타입 소실 |
| `status: FileState \| null` | `type: "object"`, `required: false` | `object \| null` | 구체 타입 소실 |
| `tags: Set<string>` | `type: "array"` | `unknown[]` | 의미론 소실 |

**정책:**

1. **TypeSpec 우선 원칙**: 정확한 도메인 구조 타입은 `schema.types` (TypeSpec)에서 생성
2. **StateSpec은 보조**: state 타입은 "구조 검증용 기본 타입"으로만 취급. TypeSpec에 대응하는 named type이 있으면 참조
3. **Degrade + Diagnostic**: 표현 불가능한 구조는 `unknown`으로 degrade하고 `Diagnostic.warn` emit
4. **미래 경로**: Compiler가 state root를 합성 TypeSpec(`DomainState` named type)으로 생성하면, codegen은 StateSpec 대신 해당 TypeSpec 사용 — 별도 ADR 대상

### 3.9 Recommended Output Layout

**TypeScript types** (runtime 무의존, 공유 목적):

```
packages/schema/generated/
  types.ts          ← TypeSpec에서 생성된 named types (1차 대상)
  state.ts          ← StateSpec에서 생성된 best-effort DomainState
  actions.ts        ← ActionSpec input types
  index.ts          ← re-export
```

**Zod schemas** (Host boundary 전용):

```
packages/host/schemas/
  generated/
    base.ts         ← AUTO-GENERATED, DO NOT EDIT
  refine.ts         ← HANDWRITTEN overlay
  index.ts          ← export refined schemas only
```

> **패키지 경계 규칙**: `packages/schema`에서는 Zod를 import하지 않는다. Zod 산출물은 반드시 Host 측에 위치. schema 패키지의 runtime 무의존성 보장.

### 3.10 Refine Overlay 규약

Refine은 항상 base를 **확장**하는 형태로만 작성. base 구조를 재정의하면 drift 발생.

```typescript
// packages/host/schemas/refine.ts

import {
  ProofNodeBaseSchema,
  ProofTreeBaseSchema,
} from './generated/base';

// ✅ 올바른 패턴: base를 확장
export const ProofNodeSchema = ProofNodeBaseSchema.refine(
  (data) => !hasCycle(data.dependencies),
  { message: "ProofNode dependencies must be acyclic" }
);

export const ProofTreeSchema = ProofTreeBaseSchema.refine(
  (data) => allNodesReachable(data.root, data.nodes),
  { message: "All nodes must be reachable from root" }
);

// ❌ 금지 패턴: base 구조를 refine에서 재정의
// export const ProofNodeSchema = z.object({ ... });
```

```typescript
// packages/host/schemas/index.ts

// 외부에는 refined 스키마만 export
export { ProofNodeSchema, ProofTreeSchema } from './refine';

// base는 내부 구현 디테일 — 직접 export하지 않음
```

**Drift 검출의 범위와 한계:**

`z.ZodType<T>` 어노테이션은 **base 스키마 ↔ TS 타입** 간의 구조적 정합성을 컴파일 타임에 검출. 단, refine overlay 내부의 `data.dependencies` 등 필드 접근이 실패하는 경우는 **런타임에서만 검출**. CI에서 refine 포함 테스트를 실행하여 완화.

### 3.11 생성물 헤더

모든 생성 파일 최상단에 다음 주석 포함:

```typescript
// @generated by @manifesto-ai/codegen — DO NOT EDIT
// Source: domain.mel | Schema hash: abc123...
```

**타임스탬프 정책**: 기본 모드에서는 타임스탬프 미포함 (결정성 보장). 디버그 목적으로 `--stamp` 옵션 제공.

---

## 4. DomainSchema 동기화 프로토콜

### 4.1 버전 계약

```jsonc
// codegen/package.json
{
  "peerDependencies": {
    "@manifesto-ai/core": "~2.0.0"  // pin until TypeDefinition stabilizes
  }
}
```

### 4.2 Unknown Kind Fallback (필수)

모든 플러그인은 `TypeDefinition.kind` exhaustive check에서 unknown case를 반드시 처리:

```typescript
function mapTypeDefinition(def: TypeDefinition): string {
  switch (def.kind) {
    case "primitive": return mapPrimitive(def.type);
    case "array":     return `${mapTypeDefinition(def.element)}[]`;
    case "record":    return `Record<${mapTypeDefinition(def.key)}, ${mapTypeDefinition(def.value)}>`;
    case "object":    return mapObject(def.fields);
    case "union":     return def.types.map(mapTypeDefinition).join(" | ");
    case "literal":   return JSON.stringify(def.value);
    case "ref":       return def.name;
    default: {
      diagnostics.push({
        level: "warn",
        plugin: "ts",
        message: `Unknown TypeDefinition kind: "${(def as any).kind}". Emitting "unknown".`,
      });
      return "unknown";
    }
  }
}
```

### 4.3 Cross-Repo CI

Core 레포의 `DomainSchema` 관련 파일 변경 시:

1. Core CI가 GitHub Actions `repository_dispatch`로 codegen 레포에 이벤트 발송
2. Codegen 레포에서 최신 Core로 테스트 실행
3. 실패 시 자동 이슈 생성 (`label: schema-sync`)

```yaml
# core repo: .github/workflows/notify-codegen.yml
on:
  push:
    paths:
      - 'packages/core/src/schema/**'
      - 'packages/core/src/types/**'
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: peter-evans/repository-dispatch@v3
        with:
          repository: manifesto-ai/codegen
          event-type: core-schema-changed
          client-payload: '{"core_version": "${{ github.sha }}"}'
```

---

## 5. Consequences

### 5.1 Positive

- compiler는 IR 생성기로서 안정성 유지, codegen은 자유 진화
- TS/Zod 뿐 아니라 JSON Schema 등 타겟 확장 용이
- MEL/DomainSchema 변경 시 타입/validator drift를 구조적 제거
- Host boundary 검증 책임 명확화 (overlay refine), 도메인 의미론의 스키마 침식 방지
- FilePatch 모델로 플러그인 조합이 Manifesto patch 메커니즘과 동일 mental model
- 파일 충돌이 기본 error로 감지 — 조용한 데이터 소실 방지

### 5.2 Negative / Trade-offs

- **DomainSchema 동기화 비용**: Core 변경 시 즉시 반영 불가. Cross-repo CI와 unknown fallback으로 완화
- **StateSpec 표현력 한계**: state.ts는 best-effort, 일부 필드 `unknown` degrade. TypeSpec 우선 원칙으로 완화
- **플러그인/산출물 레이아웃 규약**: 초기 설정/학습 비용 증가
- **Zod refine 수동 유지**: 의미론적 검증은 자동 생성 불가, 별도 유지 필요
- **순환 참조 복잡도**: `ref` kind의 `z.lazy()` 처리가 Zod 타입 추론을 복잡하게 함

### 5.3 리스크 수용 기준

| 조건 | 현재 상태 | 완화 전략 |
|------|-----------|-----------|
| `TypeDefinition` kind 추가 빈도 | Core v2.x에서 활발 | unknown fallback + pin 전략 |
| Cross-repo CI 인프라 | 미구축 | Action Item으로 포함 |
| codegen 팀과 Core 팀 동기화 | 동일 팀 | 팀 분리 시 재검토 |

**재검토 트리거**: 팀 분리 시 또는 `TypeDefinition` 변경으로 인한 codegen 장애가 분기당 2회 이상 발생 시 모노레포 통합 재검토.

---

## 6. Alternatives Considered

### A) compiler 내부에 codegen 내장

- **단점**: TS/Zod 생태계 의존성으로 compiler가 무거워지고, 언어 중립성 훼손
- → **채택하지 않음**

### B) compiler plugin 시스템으로만 제공

- **단점**: compiler가 codegen 실행 환경/의존성을 끌어안음
- → **채택하지 않음** ("codegen은 consumer" 원칙 유지)

### C) TS 타입에서 Zod를 역생성 (zod-from-ts)

- **단점**: 진실원이 TS로 이동, MEL/TS 간 drift 발생
- → **채택하지 않음** (진실원은 MEL/DomainSchema)

### D) codegen을 Core 모노레포 패키지로 유지

- **장점**: `DomainSchema` 변경과 codegen 업데이트를 원자적 PR로 처리
- **단점**: Core 레포가 DX 도구 의존성을 끌어안음. 릴리즈 주기 결합
- → **현재 모노레포 내 배치하되, 독립 레포 분리는 추후 검토**

### E) CodegenOutput을 `{ path, content }[]`로 (단순 파일 리스트)

- **단점**: 충돌 감지가 runner 암묵적 동작에 의존. delete 불가. incremental 확장 어려움
- → **채택하지 않음** (FilePatch 모델이 Manifesto 철학과 정합)

---

## 7. Resolved Questions

| Question | Decision |
|----------|----------|
| 생성물 커밋 정책 | **커밋한다.** 코드 리뷰에서 확인, `git diff`로 의도하지 않은 변경 감지, CI freshness 검증 |
| watch/dev 모드 | **v0.1 미지원.** DomainSchema 변경 빈도가 일/주 단위, CLI 수동 실행 충분 |
| sourceMap/docstring | **v0.1 미지원.** `@generated` 헤더로 충분 |
| plugin ordering | **배열 순서 = 실행 순서.** `enforce`는 서드파티 생태계 형성 시 도입 |
| Zod refine overlay 표준화 | **TypeScript 패턴 가이드.** Section 3.10의 규약으로 충분 |

---

## 8. Open Questions

1. **StateSpec `FieldType` enum 처리**: `{ enum: readonly unknown[] }`을 TS union 리터럴로 변환 시 `as const` 어서션 필요 여부
2. **다중 DomainSchema 지원**: 하나의 codegen 실행에서 여러 schema를 처리하는 API 설계
3. **Compiler 합성 타입 (DomainState)**: StateSpec 표현력 한계를 근본 해결하려면 Compiler가 state root를 TypeSpec으로 합성 필요 — 별도 ADR 대상

---

## 9. Action Items

- [ ] `@manifesto-ai/codegen` core 패키지 (generate API + FilePatch runner + 충돌 검사 + outDir clean + plugin name 유일성 검증 + path 안전 검사)
- [ ] `@manifesto-ai/codegen-plugin-ts` MVP (`types.ts`, `state.ts`, `actions.ts` 생성)
- [ ] `@manifesto-ai/codegen-plugin-zod` MVP (`base.ts` 생성, `z.lazy()` 순환 참조, artifacts 참조)
- [ ] Host refine overlay 규약 문서 (Section 3.9 기반)
- [ ] CI: `generate && git diff --exit-code` 워크플로우
- [ ] `.gitattributes`: `**/generated/** linguist-generated=true`
- [ ] ProofFlow E2E 검증 (MEL → DomainSchema → codegen → types.ts/base.ts → ProofFlow 빌드)

---

## 10. References

- Core SPEC v2.x: `DomainSchema` / `TypeSpec` / `TypeDefinition` / `StateSpec` / `ComputedSpec` / `ActionSpec`
- MEL SPEC v0.5.x: MEL-first + `compileMelDomain()` + guards semantics
- Host Contract v2.x: handler boundary + `Patch[]` 기반 오류 모델
- App SPEC v2.x: `$mel` namespace injection, `$mel` hash exclusion
- [ADR-001: Layer Separation](../../docs/internals/adr/001-layer-separation.md)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-02-05 | Initial proposal |
| 0.2.0 | 2026-02-05 | 독립 레포 동기화 전략, plugin interface 최소화, 순환 참조 처리, refine overlay 패턴 가이드, 생성 범위 명확화 |
| 0.3.0 | 2026-02-05 | artifacts 전달 경로, StateSpec 한계 정책, FilePatch 모델, 파일 충돌 규칙, 타임스탬프 기본 OFF, drift 검출 범위 정확화 |
| 0.3.1 | 2026-02-05 | RUNNER-OUTDIR-1, RUNNER-PLUGIN-1, FILEPATCH-1/2, computed 타입 생성 MVP 제외, unknown kind fallback graceful degrade, Zod `T \| null` → `.nullable()` 최적화 |
