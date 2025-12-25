# Pass Ownership Rules

> 리뷰어 피드백 반영: 각 Pass의 책임을 명확히 정의

## 핵심 원칙

1. **단일 책임**: 각 Pass는 하나의 관심사만 처리
2. **중복 금지**: 동일한 정보를 여러 Pass가 생성하면 안 됨
3. **의존성 명시**: Pass 간 의존 관계는 명시적으로 선언
4. **결정론적 출력**: 동일 입력 → 동일 출력 (LLM Pass 제외)

---

## Pass 카탈로그

### 1. Code AST Extractor Pass

**책임**: 소스 코드를 AST로 파싱하고 Finding 추출

```
Input:  CodeArtifact (JS/TS 소스 코드)
Output: Finding[] (AST 노드 + span 정보)
```

**생성하는 것**:
- AST 노드 참조
- 소스 위치 (span) 정보
- 변수 선언, 함수 호출, 조건문 등 구조적 정보

**생성하지 않는 것**:
- Fragment (Lowering Pass의 책임)
- 타입 추론 결과 (Schema Pass의 책임)
- Expression DSL (Expression Pass의 책임)

---

### 2. Schema Pass

**책임**: 스키마 정보 추출 및 SchemaFragment/SourceFragment 생성

```
Input:  Finding[] (변수 선언, 타입 어노테이션)
Output: SchemaFragment[], SourceFragment[]
```

**생성하는 것**:
- `data.*` 스키마 필드
- `state.*` 스키마 필드
- Source 정의 (사용자 입력 필드)
- 타입 정보 (number, string, boolean, object, array)
- defaultValue

**생성하지 않는 것**:
- Expression (Expression Pass의 책임)
- Derived 계산식 (Expression Pass의 책임)
- Effect (Effect Pass의 책임)

---

### 3. Expression Pass

**책임**: 조건 표현식만 추출 및 ExpressionFragment/DerivedFragment 생성

```
Input:  Finding[] (조건문, 계산식)
Output: ExpressionFragment[], DerivedFragment[]
```

**생성하는 것**:
- **조건 표현식**: `if (a > b)` → `['>', ['get', 'a'], ['get', 'b']]`
- **계산식**: `total = items.sum(i => i.price)` → `['sum', ['map', ...]]`
- Derived 정의 (계산된 값)
- `requires` 의존성 (analyzeExpression 사용)

**생성하지 않는 것**:
- Side Effect 표현식 (Effect Pass의 책임)
- Action 정의 (Action Pass의 책임)
- Policy 조건 (Policy Pass의 책임)

**중요 규칙**:
> Expression Pass는 **조건(condition)만** 담당합니다.
> `setValue()`, `emit()` 등 부수효과가 있는 표현식은 Effect Pass가 처리합니다.

---

### 4. Effect Pass

**책임**: 부수효과만 추출 및 EffectFragment 생성

```
Input:  Finding[] (함수 호출, 할당문)
Output: EffectFragment[]
```

**생성하는 것**:
- `SetValue` 효과: 값 할당
- `SetState` 효과: 상태 변경
- `EmitEvent` 효과: 이벤트 발생
- `ApiCall` 효과: API 호출
- `Navigate` 효과: 네비게이션
- `Sequence`/`Parallel` 효과: 복합 효과
- Risk level 분류

**생성하지 않는 것**:
- 조건 표현식 (Expression Pass의 책임)
- Precondition (Policy Pass의 책임)
- Action 조립 (Action Pass의 책임)

**중요 규칙**:
> Effect Pass는 **부수효과(side effect)만** 담당합니다.
> 순수 조건/계산은 Expression Pass가 처리합니다.
>
> **AGENT_README Invariant #5**: Effect는 설명(Description)이며,
> 컴파일러는 절대 Effect를 실행하지 않습니다.

---

### 5. Policy Pass

**책임**: 정책 조건 참조 및 PolicyFragment 생성

```
Input:  Finding[] (if-guard 패턴, 조건부 렌더링)
Output: PolicyFragment[]
```

**생성하는 것**:
- Action precondition 참조
- Field visibility 정책 (relevantWhen)
- Field editability 정책 (editableWhen)
- Field required 정책 (requiredWhen)

**생성하지 않는 것**:
- 조건 표현식 자체 (Expression Pass의 책임)
- Effect 정의 (Effect Pass의 책임)

**중요 규칙**:
> Policy Pass는 **참조(reference)만** 합니다.
> 조건 표현식 자체는 Expression Pass가 이미 생성한 것을 참조합니다.
>
> 예시:
> - Expression Pass: `['>', ['get', 'derived.total'], 0]` → ExpressionFragment(id: 'expr_xxx')
> - Policy Pass: `precondition: { path: 'derived.canCheckout', expect: 'true' }`

---

### 6. Action Pass

**책임**: Action 조립 및 ActionFragment 생성

```
Input:  Finding[], PolicyFragment[], EffectFragment[]
Output: ActionFragment[]
```

**생성하는 것**:
- Action 정의 (actionId, semantic)
- Precondition 조합 (PolicyFragment 참조)
- Effect 조합 (EffectFragment 참조 또는 inline)
- Input schema 참조
- Risk level 결정

**생성하지 않는 것**:
- 새로운 Effect 정의 (Effect Pass의 책임)
- 새로운 Policy 정의 (Policy Pass의 책임)
- 새로운 Expression 정의 (Expression Pass의 책임)

**중요 규칙**:
> Action Pass는 **조립(composition)만** 담당합니다.
> 이미 다른 Pass에서 생성된 Fragment를 참조하여 조합합니다.

---

### 7. NL Pass (LLM Adapter)

**책임**: 자연어를 FragmentDraft로 변환

```
Input:  TextArtifact (자연어 설명)
Output: FragmentDraft[] (검증 필요)
```

**생성하는 것**:
- FragmentDraft (모든 종류)
- Provisional requires/provides
- Confidence score
- Reasoning (추론 근거)

**생성하지 않는 것**:
- **Fragment를 직접 생성하지 않음**
- 검증된 Expression/Effect

**중요 규칙**:
> **AGENT_README Invariant #2**: LLM은 비신뢰 제안자입니다.
>
> NL Pass는 `FragmentDraft`만 생성합니다.
> `Fragment`로의 변환은 **Deterministic Lowering** 단계에서 수행됩니다.
>
> ```
> NL Pass → FragmentDraft → Validation → Lowering → Fragment
> ```

---

## Pass 실행 순서

```mermaid
graph TD
    A[CodeArtifact] --> B[Code AST Pass]
    T[TextArtifact] --> N[NL Pass]

    B --> F[Finding[]]
    N --> D[FragmentDraft[]]

    F --> S[Schema Pass]
    F --> E[Expression Pass]
    F --> EF[Effect Pass]
    F --> P[Policy Pass]

    S --> SF[SchemaFragment]
    E --> XF[ExpressionFragment]
    E --> DF[DerivedFragment]
    EF --> EFF[EffectFragment]
    P --> PF[PolicyFragment]

    SF --> AP[Action Pass]
    XF --> AP
    DF --> AP
    EFF --> AP
    PF --> AP

    AP --> AF[ActionFragment]

    D --> V[Draft Validation]
    V --> L[Lowering]
    L --> FG[Fragment]
```

---

## Ownership 검증 체크리스트

코드 리뷰 시 다음을 확인하세요:

### Expression Pass
- [ ] 부수효과가 있는 표현식을 생성하지 않는가?
- [ ] setValue, emit 등의 호출을 Effect로 분류하지 않았는가?

### Effect Pass
- [ ] 순수 조건/계산을 Effect로 생성하지 않는가?
- [ ] Effect를 실행하지 않고 설명만 하는가?

### Policy Pass
- [ ] 조건 표현식을 직접 생성하지 않고 참조만 하는가?
- [ ] Expression ID를 올바르게 참조하는가?

### Action Pass
- [ ] 새로운 Effect/Policy를 생성하지 않고 조립만 하는가?
- [ ] 참조하는 Fragment가 존재하는지 확인하는가?

### NL Pass
- [ ] Fragment가 아닌 FragmentDraft를 반환하는가?
- [ ] Confidence score를 설정하는가?
- [ ] Provenance에 LLM 정보가 포함되는가?

---

## Pass 간 충돌 방지

### 규칙 1: 동일 provides 금지
- 같은 `provides` 경로를 여러 Pass가 생성하면 안 됨
- Linker에서 `duplicate_provides` Conflict로 감지됨

### 규칙 2: 순환 의존 금지
- Pass A가 Pass B의 출력을 입력으로 받으면, B는 A의 출력을 받을 수 없음
- 예: Schema → Expression (O), Expression → Schema (X)

### 규칙 3: Lowering 책임 분리
- Code AST Pass: Finding 생성만
- Lowering Pass (Schema/Expression/Effect/Policy/Action): Fragment 생성
- NL Pass: FragmentDraft 생성만
- Draft Lowering: FragmentDraft → Fragment 변환

---

## 관련 문서

- [AGENT_README.md](./AGENT_README.md) - 컴파일러 불변식
- [PRD.md](./PRD.md) - 제품 요구사항
