# Manifesto Studio

> **"Manifesto로 Manifesto를 만든다"**
>
> Studio는 Manifesto 프레임워크를 사용하여 Manifesto 도메인을 편집하는 도구입니다.
> 이것은 단순한 기술적 선택이 아니라, Manifesto 철학의 자기 증명(Self-Proof)입니다.

---

## 철학적 기반

### 자기 참조적 일관성 (Self-Referential Consistency)

Manifesto의 핵심 주장은 **"모든 소프트웨어는 선언(Declared)되어야 한다"**입니다.
만약 Manifesto를 만드는 도구가 Manifesto를 사용하지 않는다면, 이는 철학적 모순입니다.

```
┌─────────────────────────────────────────────────────────┐
│                    Manifesto Studio                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │              @manifesto-ai/core                  │    │
│  │   defineDomain, defineSource, defineDerived     │    │
│  │   createRuntime, validateDomain                 │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │           @manifesto-ai/bridge-react             │    │
│  │   RuntimeProvider, useValue, useSetValue        │    │
│  └─────────────────────────────────────────────────┘    │
│                         ↓                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │           사용자가 편집하는 도메인                  │    │
│  │   sources, derived, actions                      │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 원자적 진실 (Atomic Truth)

Studio의 모든 상태는 Semantic Path로 표현됩니다:

| Path | 설명 | 타입 |
|------|------|------|
| `data.domain.id` | 편집 중인 도메인 ID | string |
| `data.domain.name` | 도메인 이름 | string |
| `data.sources` | 소스 블록 정의 맵 | Record<id, EditorSource> |
| `data.derived` | Derived 블록 정의 맵 | Record<id, EditorDerived> |
| `state.selectedBlockId` | 선택된 블록 ID | string \| null |
| `state.isValidating` | 검증 중 여부 | boolean |
| `state.validationResult` | 검증 결과 | ValidationResult \| null |
| `derived.allPaths` | 모든 정의된 경로 | string[] |
| `derived.hasContent` | 콘텐츠 존재 여부 | boolean |

### 모나딕 흐름 (Monadic Flow)

상태 변경은 직접 mutation이 아닌 Effect를 통해 기술됩니다:

```typescript
// domain/actions.ts
setDomainName: defineAction({
  deps: ["data.domain.name"],
  input: z.object({ name: z.string() }),
  effect: setValue("data.domain.name", ["get", "$input.name"], "Set domain name"),
  semantic: actionSemantic("update", "Update domain name"),
}),
```

---

## 아키텍처

### 디렉토리 구조

```
src/
├── domain/                  # Manifesto 도메인 정의
│   ├── types.ts            # EditorSource, EditorDerived 타입
│   ├── sources.ts          # defineSource 정의
│   ├── derived.ts          # defineDerived 정의 (Expression DSL)
│   ├── actions.ts          # defineAction 정의
│   └── studio-domain.ts    # defineDomain 통합
│
├── runtime/                 # Runtime 통합
│   ├── runtime-provider.tsx # StudioRuntimeProvider
│   └── hooks.ts            # 타입된 훅 + useStudioValidation
│
├── components/
│   ├── editor/
│   │   ├── EditorToolbar.tsx
│   │   ├── blocks/         # SchemaBlock, DerivedBlock
│   │   └── extensions/     # TipTap 확장
│   ├── issues/             # IssuesPanel, IssueItem
│   └── layout/             # EditorLayout
│
└── app/                     # Next.js 페이지
    ├── layout.tsx
    ├── providers.tsx
    └── editor/page.tsx
```

### 데이터 흐름

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   TipTap     │────▶│   Runtime    │────▶│ localStorage │
│   Editor     │◀────│   (Manifesto)│◀────│              │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │             ┌──────────────┐
       │             │  Validation  │
       │             │   (300ms)    │
       │             └──────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│    Block     │     │   Issues     │
│  Components  │     │    Panel     │
└──────────────┘     └──────────────┘
```

---

## 핵심 구현

### 1. Domain 정의

```typescript
// domain/studio-domain.ts
export const studioDomain = defineDomain({
  id: "manifesto-studio",
  name: "Manifesto Studio",
  description: "Visual IDE for creating and editing Manifesto Domains",

  dataSchema,      // 영속 데이터 스키마
  stateSchema,     // UI 상태 스키마
  initialState,    // 초기 상태

  paths: {
    sources,       // defineSource 정의들
    derived,       // defineDerived 정의들
  },

  actions,         // defineAction 정의들
});
```

### 2. Runtime Provider

```typescript
// runtime/runtime-provider.tsx
export function StudioRuntimeProvider({ children }) {
  const runtime = useMemo(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initialData = saved ? JSON.parse(saved) : defaultInitialData;
    return createRuntime({ domain: studioDomain, initialData });
  }, []);

  useEffect(() => {
    // 변경시 자동 저장
    return runtime.subscribe((snapshot) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot.data));
    });
  }, [runtime]);

  return (
    <RuntimeProvider runtime={runtime} domain={studioDomain}>
      {children}
    </RuntimeProvider>
  );
}
```

### 3. 컴포넌트에서 사용

```typescript
// components/editor/EditorToolbar.tsx
function EditorToolbar() {
  const { value: domainName } = useDomainName();
  const { setValue } = useSetValue();

  return (
    <Input
      value={domainName}
      onChange={(e) => setValue("data.domain.name", e.target.value)}
    />
  );
}
```

### 4. Derived 정의 (Expression DSL)

```typescript
// domain/derived.ts
export const derived = {
  allPaths: defineDerived({
    deps: ["data.sources", "data.derived"],
    expr: [
      "concat",
      ["map", ["values", ["get", "data.sources"]], ["get", "$.path"]],
      ["map", ["values", ["get", "data.derived"]], ["get", "$.path"]],
    ] as Expression,
    semantic: semantic("array", "All defined semantic paths"),
  }),

  hasContent: defineDerived({
    deps: ["data.sources", "data.derived"],
    expr: [
      "any",
      [">", ["length", ["keys", ["get", "data.sources"]]], 0],
      [">", ["length", ["keys", ["get", "data.derived"]]], 0],
    ] as Expression,
    semantic: semantic("boolean", "Whether any blocks exist"),
  }),
};
```

---

## 검증 시스템

Studio는 편집 중인 도메인을 실시간으로 검증합니다:

| 규칙 | 설명 | 심각도 |
|------|------|--------|
| 도메인 ID 필수 | `domain.id`가 비어있으면 안됨 | error |
| 도메인 이름 필수 | `domain.name`이 비어있으면 안됨 | error |
| Source 경로 형식 | `data.`로 시작해야 함 | error |
| Derived 경로 형식 | `derived.`로 시작해야 함 | error |
| 의존성 존재 | Derived의 deps가 실제 존재해야 함 | error |

### 자동 수정 제안

```typescript
// 잘못된 경로 → 자동 수정 제안
"userName" → suggestedFix: { value: "data.userName" }
"total"    → suggestedFix: { value: "derived.total" }
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | Next.js 15 (App Router) |
| 상태 관리 | @manifesto-ai/core + bridge-react |
| 에디터 | TipTap (ProseMirror 기반) |
| 스타일링 | Tailwind CSS + shadcn/ui |
| 검증 | Zod |

---

## 실행

```bash
# 개발 서버
pnpm --filter @manifesto-ai/studio dev

# 빌드
pnpm --filter @manifesto-ai/studio build

# 프로덕션 실행
pnpm --filter @manifesto-ai/studio start
```

---

## 철학적 결론

Studio는 단순한 IDE가 아닙니다. 이것은 Manifesto 철학의 **살아있는 증거**입니다.

1. **Atomic Truth**: 모든 상태가 Semantic Path로 주소화됨
2. **Monadic Flow**: Effect를 통한 안전한 상태 변경
3. **Self-Explainable**: Validation이 "왜" 틀렸는지 설명함
4. **Agent Native**: JSON 기반 Expression DSL

> "코드를 작성할 때, 이 철학적 우아함을 훼손하지 마라.
> 단순함이 궁극의 정교함이다."
> — CLAUDE.md
