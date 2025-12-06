# 📘 manifesto-ai UI 아키텍처 기획 v1

### (1) Field Renderer Registry

### (2) Semantic Renderer Registry

### (3) Adapter Layer (React/Vue)

**전제:**
엔진(engine)은 Entity/View/Action 계약(Contract)을 생성하는 역할만 하고,
UI는 전적으로 `ui/` 패키지에서 처리한다.

---

# 1) Field Renderer Registry (Atomic UI Layer)

## 🎯 목표

각 UI 프레임워크(React/Vue)가 서로 독립적으로 “어떤 필드 타입을 어떻게 그릴지”만 담당하고,
**Manifesto가 제공하는 의미론적 스키마와 상태값을 “어떻게 표현할지”를 registry(컴포넌트 등록소)가 관리한다.**

즉:

* 필드는 의미론적 단위가 아니라 “표현 단위(UI atomic 요소)”
* 각 필드 타입을 1:1로 UI 컴포넌트에 매핑하는 책임 가짐
* Renderer Registry는 교체 가능 → UI Kit Customization이 쉬워짐
* 의미론(visibility, disabled, validation)은 엔진이 계산하고 UI는 표현만 함

---

## 🧩 핵심 개념 (의미 중심 설명)

### 1. 필드는 표현의 단위이며 의미의 단위가 아니다

“name” 필드는

* text-input 일 수도 있고
* rich-editor일 수도 있고
* AI가 생성한 custom field일 수도 있다

필드 타입은 도메인과 무관하며 **UI 레이어에서만 해석되는 정보**다.

### 2. 필드 registry는 UI를 자유롭게 구성하도록 해주는 인터페이스

Manifesto는 다음을 보장한다:

* 필드는 엔진에서 계산된 contract(FieldContract)를 UI에 넘긴다
* UI는 Registry에서 해당 필드 타입의 Renderer를 가져온다
* 개발자는 registry를 교체함으로써 전체 UI 스타일을 바꿀 수 있다

---

## 🏗 필드 레지스트리가 제공해야 하는 것 (의미 요약)

| 역할           | 의미                          |
| ------------ | --------------------------- |
| 필드 타입을 등록    | UI 라이브러리 확장                 |
| 필드 타입 조회     | ViewRenderer가 동적으로 UI 구성    |
| 필드 타입 목록     | 도구/에디터/AI를 위한 introspection |
| Lazy load 지원 | UI 패키지의 무거운 컴포넌트를 지연 로딩     |

---

## 📝 필드 Registry는 다음 범위까지만 책임진다

* text-input
* number-input
* checkbox
* select
* date-picker
* rich-editor
* ...
  → atomic UI 요소 단위

**절대 이보다 큰 단위를 책임지면 안 됨**
(그건 시멘틱 Renderer의 영역)

---

# 2) Semantic Renderer Registry (Meaningful UI Layer)

## 🎯 목표

Manifesto가 정의한 **Form / ListTable / Detail** 같은 의미 단위(View Schema)를
UI 프레임워크 독립적인 **Semantic Tree**로 변환하고,
해당 트리를 렌더러(ViewRenderer)가 재구성할 수 있게 한다.

이 레이어에 registry가 필요하다.

---

## 🧩 핵심 개념 (의미 중심 설명)

### ✔ 의미 단위(View-Type)와 표현 단위(Field-Type)는 다르다

* 필드 레지스트리: UI 구성요소 단위 (atomic)
* 시멘틱 레지스트리: Form, List, Detail 같은 “업무 의미 단위”

### ✔ Manifesto Engine은 UI를 직접 만들지 않는다

엔진은 다음과 같은 contract만 넘김:

```
FormContract
ListContract
DetailContract
FieldContract[]
ActionContract[]
```

Semantic Renderer Registry는 이 contract를 받아
**“UI 프레임워크 독립 semantic tree”**를 만든다.

---

## 🏗 시멘틱 Renderer Registry가 제공해야 하는 것

| 책임                         | 의미                         |
| -------------------------- | -------------------------- |
| ViewRenderer 등록            | Form/List/Detail의 조립 전략 제공 |
| Semantic Tree 생성           | 엔진 계약을 UI 독립적 구조로 변환       |
| UI Adapter가 이해할 수 있는 구조 제공 | React/Vue/AI가 읽고 표출        |

---

## 📐 Semantic Tree 예 (의미 중심)

예시로 FormContract로부터 만들어지는 Semantic Tree:

```
FormViewNode
 ├── SectionNode("Basic Info")
 │     ├── FieldNode("name")
 │     ├── FieldNode("category")
 ├── SectionNode("Pricing")
 │     ├── FieldNode("price")
 │     ├── FieldNode("currency")
 ├── ActionNode("save")
 └── ActionNode("cancel")
```

이 Tree는 UI 기술과 무관하고,
AI가 이해하기에도 훨씬 최적화된 구조다.

React Adapter는 이 트리를 React 컴포넌트로 변환하고
Vue Adapter는 Vue 컴포넌트로 변환하며
AI Renderer는 AI가 컴포넌트를 만들어낸다.

---

## 📝 Semantic Renderer Registry가 가져야 할 범위

* Form Renderer
* List Renderer
* Detail Renderer

### ❌ SectionRenderer / ColumnRenderer은 Registry에 넣지 않는다

왜?

* Section/Column은 의미 단위가 아니라 구조 단위
* 의미론적 구분이 불명확
* Registry 단위가 너무 커져 유지보수 악화
* View Renderer 내부의 구현 전략으로 처리하는 게 맞음

---

# 3) UI Adapter Layer (React/Vue)

## 🎯 목표

Semantic Tree를 React/Vue 컴포넌트 트리로 변환하는 “표현 책임 레이어”

엔진은 의미를 계산
Semantic Renderer는 의미를 구조화
Adapter는 구조를 UI로 표현
FieldRegistry는 UI 요소를 렌더링

각 레이어가 독립적이며 조합된다.

---

## 🧩 Adapter Layer의 본질적 역할

### ✔ Semantic Tree → UI Framework Tree

Adapter는 Manifesto 엔진이나 Renderer Registry의 의미를 바꾸지 않는다.
단지:

* React의 JSX로 그리는지
* Vue의 h()로 그리는지
* AI가 React 코드를 생성하게 할지
* SSR인지 CSR인지
* Streaming인지

이러한 **표현 방식의 차이를 흡수**하는 계층이다.

---

## 🏗 Adapter Layer의 의미적 책임

| 역할                                | 설명                                           |
| --------------------------------- | -------------------------------------------- |
| Semantic Node → React/Vue 컴포넌트 변환 | UI 렌더링의 진짜 시작점                               |
| FieldRenderer 호출                  | registry에서 컴포넌트 조회                           |
| Action trigger 연결                 | semantic-level action contract ↔ UI event 연결 |
| Layout 표현                         | flex/grid/table 같은 표현 전략 반영                  |
| Custom 스타일 테마 적용                  | UI customization layer 분리                    |

---

## Adapter Layer에서 "하지 말아야" 하는 일

* 필드/액션의 의미를 재해석하면 안 됨
* hidden/disabled 등 constraint를 다시 계산하면 안 됨
* validation 로직을 UI에 두면 안 됨
* workflow 로직을 UI에서 만들면 안 됨

단지 **표현(work)이 아니라 의미 의미 표현(expression)**만 담당해야 함.

---

# 📦 최종 아키텍처 요약

```
/engine
  - contracts (FieldContract, ActionContract, ViewContract)
  - validation / expression / dag

/ui
  /registry
     fieldRegistry.ts        ← atomic UI registry
     semanticRegistry.ts     ← form/list/detail registry (추가)
  /semantic
     buildSemanticTree.ts    ← view contract → semantic tree
  /adapter
     reactAdapter.ts         ← tree → JSX
     vueAdapter.ts           ← tree → h() 구성
  /components
     react-inputs/*          ← atomic ui
     vue-inputs/*            ← atomic ui
```

---

# 🎉 결론

1. **필드 레지스트리**
   이미 훌륭함. 그대로 유지.

2. **시멘틱 렌더러 레지스트리**
   Form/List/Detail 단위의 의미론 조합 레이어를 추가해야 함.
   핵심은 프레임워크 독립적 “semantic tree builder”.

3. **어댑터 레이어**
   React/Vue는 semantic tree만 받아 UI를 구성하는 표현 레이어가 됨.

이렇게 하면:

* 엔진은 의미만 계산
* UI는 표현만 담당
* Manifesto는 UI 프레임워크 독립적
* AI Renderer도 자연스럽게 참여 가능

즉, **AI-Native UI Layer로서의 최종 형태**가 완성된다.
