# [PROJECT_NAME]

<!-- INSTRUCTION: 
한 문장으로 프로젝트의 본질을 정의합니다.
"X는 Y를 위한 Z이다" 형식이 좋습니다.
-->

> **[PROJECT_NAME]** is [ONE_SENTENCE_DEFINITION].

<!-- INSTRUCTION:
배지는 최소한으로. npm version, license, build status 정도만.
-->

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is [PROJECT_NAME]?

<!-- INSTRUCTION:
3-5문장으로 핵심 가치 제안을 설명합니다.
기술적 디테일 NO, 철학적 에세이 NO.
"무엇을", "왜", "어떻게(고수준)"만.
-->

[PROJECT_NAME] solves [PROBLEM] by [APPROACH].

Traditional [DOMAIN] systems struggle with [PAIN_POINT]. [PROJECT_NAME] takes a fundamentally different approach: [KEY_INSIGHT].

```
[SIMPLE_DIAGRAM_OR_FLOW]
```

---

## What This Is NOT

<!-- INSTRUCTION:
매우 중요한 섹션입니다.
사람들이 흔히 오해하는 것들을 명시적으로 부정합니다.
-->

| [PROJECT_NAME] is NOT... | Instead, it is... |
|--------------------------|-------------------|
| ❌ A [COMMON_MISCONCEPTION_1] | ✅ A [ACTUAL_THING_1] |
| ❌ A [COMMON_MISCONCEPTION_2] | ✅ A [ACTUAL_THING_2] |
| ❌ A replacement for [THING] | ✅ A complement that [RELATIONSHIP] |

---

## Core Concepts

<!-- INSTRUCTION:
3-5개의 핵심 개념만. 각각 1-2문장으로.
상세 설명은 ARCHITECTURE.md로 링크.
-->

| Concept | One-Liner |
|---------|-----------|
| **[Concept1]** | [Brief description] |
| **[Concept2]** | [Brief description] |
| **[Concept3]** | [Brief description] |

→ See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete mental model.

---

## Quick Start

<!-- INSTRUCTION:
30초 안에 "맛보기"를 할 수 있는 최소 코드.
복붙해서 바로 실행 가능해야 합니다.
-->

```bash
npm install @[org]/[package]
```

```typescript
import { [mainExport] } from '@[org]/[package]';

// Minimal working example
const [instance] = [mainExport]([minimal_config]);
const result = [instance].[method]([args]);

console.log(result);
// → [expected_output]
```

→ See [Getting Started Guide](./packages/core/GUIDE.md) for the full tutorial.

---

## Packages

<!-- INSTRUCTION:
각 패키지의 역할을 한 줄로.
상세 내용은 각 패키지 README로 링크.
-->

| Package | Description | Docs |
|---------|-------------|------|
| [`@[org]/core`](./packages/core) | [Core responsibility] | [README](./packages/core/README.md) |
| [`@[org]/host`](./packages/host) | [Host responsibility] | [README](./packages/host/README.md) |
| [`@[org]/world`](./packages/world) | [World responsibility] | [README](./packages/world/README.md) |
| [`@[org]/builder`](./packages/builder) | [Builder responsibility] | [README](./packages/builder/README.md) |

---

## Architecture Overview

<!-- INSTRUCTION:
전체 레이어 다이어그램.
ASCII art나 Mermaid 사용.
-->

```
┌─────────────────────────────────────────────────────────┐
│                      [LAYER_NAME]                       │
│  [Brief description of this layer's responsibility]    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      [LAYER_NAME]                       │
│  [Brief description of this layer's responsibility]    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      [LAYER_NAME]                       │
│  [Brief description of this layer's responsibility]    │
└─────────────────────────────────────────────────────────┘
```

→ See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed explanation.

---

## Examples

<!-- INSTRUCTION:
실제 동작하는 예제 프로젝트 링크.
각 예제가 무엇을 보여주는지 명시.
-->

| Example | What it demonstrates |
|---------|---------------------|
| [minimal](./examples/minimal) | Bare minimum setup |
| [todo-app](./examples/todo-app) | Basic CRUD operations |
| [with-hitl](./examples/with-hitl) | Human-in-the-loop approval |

---

## Documentation

<!-- INSTRUCTION:
문서 타입별로 링크 정리.
-->

| Type | For whom | Link |
|------|----------|------|
| **Guides** | Users who want to learn | [Getting Started](./packages/core/GUIDE.md) |
| **Specs** | Implementers & reviewers | [Core Spec](./packages/core/SPEC.md) |
| **Rationale** | Contributors & researchers | [Design Decisions](./packages/core/FDR.md) |
| **Glossary** | Everyone | [Terms & Definitions](./GLOSSARY.md) |
| **FAQ** | Everyone | [Frequently Asked Questions](./FAQ.md) |

---

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md).

For significant changes, please open an issue first to discuss what you would like to change.

→ See [GOVERNANCE.md](./GOVERNANCE.md) for our decision-making process.

---

## License

[MIT](./LICENSE) © [Year] [Organization]

---

## Acknowledgments

<!-- INSTRUCTION:
영감을 준 프로젝트, 기여자 등.
선택 섹션.
-->

- [Project A](link) for [inspiration]
- [Project B](link) for [inspiration]
