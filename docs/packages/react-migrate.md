# @manifesto-ai/react-migrate PRD v1.0.1

## Overview

React 코드베이스를 분석하여 Manifesto 호환 도메인 스키마를 자동 추출하는 **Manifesto Runtime 기반** 에이전트 마이그레이션 도구.

**핵심 가치:** 기존 React 앱에 AI 접근성을 부여하는 진입 장벽을 제거한다.

**아키텍처 원칙:** Orchestrator 자체가 Manifesto Domain으로 작동한다. Agent 시스템을 위한 별도 프레임워크가 아니라, Manifesto Runtime이 곧 Agent Runtime이다.

```
기존 React 앱 → npx @manifesto-ai/react-migrate → Manifesto 호환 앱
```

---

## Goals

1. React 생태계 전체(컴포넌트, hooks, context, forms, state)에서 도메인 추출
2. 80% 이상 자동 변환, 나머지는 HITL로 해결
3. GPT-4o-mini로 작동하여 비용 우위 증명
4. 세션 중단 후 재시작해도 진행률 100% 복원
5. **Manifesto Agent OS 아키텍처의 PoC로서 자기 증명**

---

## Non-Goals

1. Vue, Svelte, Angular 등 타 프레임워크 지원 (v1.0 범위 외)
2. 런타임 동작 분석 (정적 분석만 수행)
3. 레거시 Class 컴포넌트 완벽 지원 (베스트 에포트)
4. Schema 자동 수정 (불변성 원칙)

---

## Core Philosophy: Agent as Manifesto Domain

이 시스템의 핵심 철학:

> **에이전트가 Manifesto 엔진을 "사용"하는 것이 아니라,  
> Manifesto 엔진 "위에서" 에이전트 시스템 자체가 실행된다.**

```
┌─────────────────────────────────────────────┐
│           Manifesto Runtime                  │
│  ┌───────────────────────────────────────┐  │
│  │         Orchestrator Domain           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │  │
│  │  │Analyzer │ │Summarizer│ │Transform│ │  │
│  │  │ Domain  │ │ Domain  │ │ Domain  │ │  │
│  │  └─────────┘ └─────────┘ └─────────┘ │  │
│  └───────────────────────────────────────┘  │
│                     ↕                        │
│              Event Bus (Channel)             │
│                     ↕                        │
│  ┌───────────────────────────────────────┐  │
│  │     External Actors (Reviewer, HITL)  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

이로 인해:
- Intent = Effect Descriptor (replay, chaining, undo/redo 가능)
- Snapshot = World State (deterministic, resumable)
- Agent 통신 = Manifesto Event System
- Validation = Manifesto Core ValidationResult

---

## Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Human (Terminal)                         │
│                          ↑↓                                   │
│                    Ink CLI Projection                         │
├──────────────────────────────────────────────────────────────┤
│                 Manifesto Runtime Engine                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Orchestrator Domain                      │    │
│  │  Snapshot: {                                          │    │
│  │    "data.phase": "ANALYZING",                         │    │
│  │    "data.progress.total": 300,                        │    │
│  │    "data.progress.completed": 186,                    │    │
│  │    "state.children.analyzer": { ref, status },        │    │
│  │    "state.children.summarizer": { ref, status },      │    │
│  │    "state.hitl.pending": true,                        │    │
│  │    "derived.confidence": 0.82,                        │    │
│  │    "derived.canProceed": true,                        │    │
│  │    "meta.self.attempts": 2,                           │    │
│  │    "meta.self.currentModel": "gpt-4o-mini"            │    │
│  │  }                                                    │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
├─────────────┬─────────────┬─────────────┬────────────────────┤
│  Analyzer   │ Summarizer  │ Transformer │     Event Bus      │
│  Domain     │ Domain      │ Domain      │    (Channels)      │
└─────────────┴─────────────┴─────────────┴────────────────────┘
                                                    ↓
                                          ┌─────────────────┐
                                          │ Reviewer Actor  │
                                          │ (External)      │
                                          └─────────────────┘
```

---

## Semantic Path Namespace

모든 Snapshot 키는 SemanticPath 규칙을 따른다:

| Namespace | Purpose | Example |
|-----------|---------|---------|
| `data.*` | 태스크 관련 원시 데이터 | `data.phase`, `data.progress.total` |
| `state.*` | 런타임 상태, 참조 | `state.children.analyzer`, `state.hitl.pending` |
| `derived.*` | 계산된 값 (read-only) | `derived.confidence`, `derived.canProceed` |
| `meta.*` | 메타인지, 자기 참조 | `meta.self.attempts`, `meta.self.currentModel` |
| `async.*` | 비동기 외부 요청 | `async.reviewer`, `async.hitl` |

이 구조로 인해 **Orchestrator 자체를 Manifesto Runtime으로 실행 가능**해진다.

---

## Agent Domain Specifications

### Orchestrator Domain

**역할:** 전체 파이프라인 조율, HITL 관리, 하위 도메인 오케스트레이션

**Schema:**
```typescript
// orchestrator.domain.json
{
  "$schema": "https://manifesto-ai.dev/schema/domain.v1.json",
  "name": "orchestrator",
  "version": "1.0.0",
  
  "schema": {
    "entities": {
      "agentRef": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "status": { 
            "type": "string", 
            "enum": ["IDLE", "RUNNING", "WAITING", "DONE", "FAILED"] 
          },
          "snapshotRef": { "type": "string", "format": "uri" }
        }
      },
      "hitlRequest": {
        "type": "object",
        "properties": {
          "file": { "type": "string" },
          "pattern": { "type": "string" },
          "question": { "type": "string" },
          "options": { 
            "type": "array", 
            "items": { "$ref": "#/entities/hitlOption" } 
          }
        }
      },
      "hitlOption": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" },
          "action": { "type": "string" },
          "confidence": { "type": "number" }
        }
      }
    },
    
    "state": {
      "data.phase": { 
        "type": "string", 
        "enum": ["INIT", "ANALYZING", "SUMMARIZING", "TRANSFORMING", "COMPLETE", "FAILED"] 
      },
      "data.progress.total": { "type": "integer" },
      "data.progress.completed": { "type": "integer" },
      "data.progress.blocked": { "type": "integer" },
      "data.progress.skipped": { "type": "integer" },
      
      "state.children.analyzer": { "$ref": "#/entities/agentRef" },
      "state.children.summarizer": { "$ref": "#/entities/agentRef" },
      "state.children.transformer": { "$ref": "#/entities/agentRef" },
      
      "state.hitl.pending": { "type": "boolean" },
      "state.hitl.request": { "$ref": "#/entities/hitlRequest", "nullable": true },
      "state.hitl.history": { 
        "type": "array", 
        "items": { "type": "object" } 
      },
      
      "derived.confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "derived.canProceed": { "type": "boolean" },
      "derived.estimatedTimeRemaining": { "type": "integer" },
      
      "meta.self.attempts": { "type": "integer" },
      "meta.self.lastError": { "type": "string", "nullable": true },
      "meta.self.currentModel": { 
        "type": "string", 
        "enum": ["gpt-4o-mini", "gpt-4o", "claude-sonnet"] 
      },
      "meta.self.contextUsage": { "type": "number" }
    },
    
    "intents": {
      "startAnalysis": {
        "effect": "orchestrator:start",
        "params": { "rootDir": { "type": "string" } },
        "effects": ["data.phase", "state.children.analyzer"]
      },
      "delegate": {
        "effect": "orchestrator:delegate",
        "params": {
          "to": { "type": "string", "enum": ["analyzer", "summarizer", "transformer"] },
          "task": { "type": "object" }
        },
        "effects": ["state.children.*"]
      },
      "requestHitl": {
        "effect": "orchestrator:hitl:request",
        "params": { "request": { "$ref": "#/entities/hitlRequest" } },
        "effects": ["state.hitl.pending", "state.hitl.request"]
      },
      "resolveHitl": {
        "effect": "orchestrator:hitl:resolve",
        "params": { 
          "optionId": { "type": "string" },
          "customInput": { "type": "string", "nullable": true }
        },
        "effects": ["state.hitl.pending", "state.hitl.request", "state.hitl.history"]
      },
      "upgradeModel": {
        "effect": "orchestrator:model:upgrade",
        "params": { "to": { "type": "string" } },
        "effects": ["meta.self.currentModel"]
      },
      "spawnReviewer": {
        "effect": "orchestrator:spawn:reviewer",
        "params": { "context": { "type": "object" } },
        "effects": ["async.reviewer"],
        "emits": ["review:request"]
      },
      "complete": {
        "effect": "orchestrator:complete",
        "params": {},
        "effects": ["data.phase"]
      },
      "abort": {
        "effect": "orchestrator:abort",
        "params": { "reason": { "type": "string" } },
        "effects": ["data.phase", "meta.self.lastError"]
      }
    }
  }
}
```

---

### Analyzer Domain

**역할:** SWC를 사용한 AST 파싱, React 패턴 식별, 도메인 후보 추출

**Schema:**
```typescript
// analyzer.domain.json
{
  "$schema": "https://manifesto-ai.dev/schema/domain.v1.json",
  "name": "analyzer",
  "version": "1.0.0",

  "schema": {
  "entities": {
    "fileTask": {
      "type": "object",
        "properties": {
        "path": { "type": "string" },
        "priority": { "type": "integer" },
        "dependencies": { "type": "array", "items": { "type": "string" } }
      }
    },
    "fileAnalysis": {
      "type": "object",
        "properties": {
        "path": { "type": "string" },
        "type": {
          "type": "string",
            "enum": ["component", "hook", "context", "util", "unknown"]
        },
        "astRef": { "type": "string", "format": "uri" },
        "exports": { "type": "array" },
        "imports": { "type": "array" },
        "patterns": { "type": "array" },
        "confidence": { "type": "number" },
        "issues": { "type": "array" }
      }
    },
    "detectedPattern": {
      "type": "object",
        "properties": {
        "type": {
          "type": "string",
            "enum": ["component", "hook", "context", "form", "reducer", "effect"]
        },
        "location": { "$ref": "#/entities/sourceLocation" },
        "extracted": { "type": "object" },
        "confidence": { "type": "number" },
        "needsReview": { "type": "boolean" }
      }
    },
    "sourceLocation": {
      "type": "object",
        "properties": {
        "start": { "type": "object", "properties": { "line": { "type": "integer" }, "column": { "type": "integer" } } },
        "end": { "type": "object", "properties": { "line": { "type": "integer" }, "column": { "type": "integer" } } }
      }
    }
  },

  "state": {
    "data.queue": { "type": "array", "items": { "$ref": "#/entities/fileTask" } },
    "data.current": { "$ref": "#/entities/fileTask", "nullable": true },
    "data.results": { "type": "object", "additionalProperties": { "$ref": "#/entities/fileAnalysis" } },

    "state.patterns.components": { "type": "array" },
    "state.patterns.hooks": { "type": "array" },
    "state.patterns.contexts": { "type": "array" },
    "state.patterns.forms": { "type": "array" },
    "state.patterns.stateManagement": { "type": "array" },

    "derived.filesProcessed": { "type": "integer" },
    "derived.parseErrors": { "type": "integer" },
    "derived.ambiguousPatterns": { "type": "integer" },

    "meta.self.attempts": { "type": "integer" },
    "meta.self.confidence": { "type": "number" }
  },

  "intents": {
    "analyzeFile": {
      "effect": "analyzer:file:analyze",
        "params": { "path": { "type": "string" } },
      "effects": ["data.current", "data.results.*", "state.patterns.*"]
    },
    "analyzeBatch": {
      "effect": "analyzer:batch:analyze",
        "params": { "paths": { "type": "array", "items": { "type": "string" } } },
      "effects": ["data.queue", "data.results.*"]
    },
    "markAmbiguous": {
      "effect": "analyzer:pattern:ambiguous",
        "params": {
        "path": { "type": "string" },
        "pattern": { "$ref": "#/entities/detectedPattern" }
      },
      "effects": ["data.results.*"],
        "emits": ["analyzer:ambiguous"]
    },
    "skipFile": {
      "effect": "analyzer:file:skip",
        "params": {
        "path": { "type": "string" },
        "reason": { "type": "string" }
      },
      "effects": ["data.queue", "data.results.*"]
    },
    "reportComplete": {
      "effect": "analyzer:complete",
        "params": {},
      "effects": [],
        "emits": ["analyzer:done"]
    }
  }
}
}
```

---

### Summarizer Domain

**역할:** 분석 결과 요약, 도메인 경계 식별, 스키마 구조 제안

**Schema:**
```typescript
// summarizer.domain.json
{
  "$schema": "https://manifesto-ai.dev/schema/domain.v1.json",
  "name": "summarizer",
  "version": "1.0.0",
  
  "schema": {
    "entities": {
      "domainSummary": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "sourceFiles": { "type": "array", "items": { "type": "string" } },
          "entities": { "type": "array" },
          "actions": { "type": "array" },
          "boundaries": { "type": "object" }
        }
      },
      "schemaProposal": {
        "type": "object",
        "properties": {
          "domain": { "type": "string" },
          "schema": { "type": "object" },
          "confidence": { "type": "number" },
          "alternatives": { "type": "array" },
          "reviewNotes": { "type": "array", "items": { "type": "string" } }
        }
      },
      "relationship": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["dependency", "sharedState", "eventFlow"] },
          "from": { "type": "string" },
          "to": { "type": "string" },
          "strength": { "type": "number" }
        }
      }
    },
    
    "state": {
      "data.analyzerRef": { "type": "string", "format": "uri" },
      "data.domains": { "type": "object", "additionalProperties": { "$ref": "#/entities/domainSummary" } },
      
      "state.relationships.dependencies": { "type": "array", "items": { "$ref": "#/entities/relationship" } },
      "state.relationships.sharedState": { "type": "array", "items": { "$ref": "#/entities/relationship" } },
      "state.relationships.eventFlows": { "type": "array", "items": { "$ref": "#/entities/relationship" } },
      
      "state.schemaProposals": { "type": "object", "additionalProperties": { "$ref": "#/entities/schemaProposal" } },
      
      "derived.domainsIdentified": { "type": "integer" },
      "derived.conflictsDetected": { "type": "integer" },
      "derived.confidence": { "type": "number" },
      
      "meta.self.attempts": { "type": "integer" }
    },
    
    "intents": {
      "summarizeDomain": {
        "effect": "summarizer:domain:summarize",
        "params": { "files": { "type": "array", "items": { "type": "string" } } },
        "effects": ["data.domains.*"]
      },
      "identifyBoundaries": {
        "effect": "summarizer:boundaries:identify",
        "params": {},
        "effects": ["state.relationships.*"]
      },
      "proposeSchema": {
        "effect": "summarizer:schema:propose",
        "params": { "domain": { "type": "string" } },
        "effects": ["state.schemaProposals.*"]
      },
      "mergeDomains": {
        "effect": "summarizer:domain:merge",
        "params": { 
          "domains": { "type": "array", "items": { "type": "string" } },
          "into": { "type": "string" }
        },
        "effects": ["data.domains.*", "state.schemaProposals.*"]
      },
      "splitDomain": {
        "effect": "summarizer:domain:split",
        "params": { 
          "domain": { "type": "string" },
          "into": { "type": "array", "items": { "type": "string" } }
        },
        "effects": ["data.domains.*", "state.schemaProposals.*"]
      },
      "reportComplete": {
        "effect": "summarizer:complete",
        "params": {},
        "effects": [],
        "emits": ["summarizer:done"]
      }
    }
  }
}
```

---

### Transformer Domain

**역할:** 최종 스키마 생성, 코드 변환, 도메인 파일 출력

**Schema:**
```typescript
// transformer.domain.json
{
  "$schema": "https://manifesto-ai.dev/schema/domain.v1.json",
  "name": "transformer",
  "version": "1.0.0",
  
  "schema": {
    "entities": {
      "transformationTask": {
        "type": "object",
        "properties": {
          "domain": { "type": "string" },
          "status": { 
            "type": "string", 
            "enum": ["PENDING", "IN_PROGRESS", "REVIEW", "DONE", "FAILED"] 
          },
          "sourceFiles": { "type": "array", "items": { "type": "string" } },
          "proposedSchema": { "type": "object" },
          "finalSchema": { "type": "object", "nullable": true },
          "changes": { "type": "array" }
        }
      },
      "domainFile": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "path": { "type": "string" },
          "content": { "type": "object" },
          "sourceMapping": { "type": "array" }
        }
      },
      "codeChange": {
        "type": "object",
        "properties": {
          "file": { "type": "string" },
          "type": { "type": "string", "enum": ["INSERT", "MODIFY", "DELETE"] },
          "location": { "type": "object" },
          "before": { "type": "string" },
          "after": { "type": "string" },
          "reason": { "type": "string" }
        }
      }
    },
    
    "state": {
      "data.summarizerRef": { "type": "string", "format": "uri" },
      "data.transformations": { "type": "object", "additionalProperties": { "$ref": "#/entities/transformationTask" } },
      
      "state.outputs.schemas": { "type": "array" },
      "state.outputs.codeChanges": { "type": "array", "items": { "$ref": "#/entities/codeChange" } },
      "state.outputs.domainFiles": { "type": "array", "items": { "$ref": "#/entities/domainFile" } },
      
      "state.validation": { "$ref": "#/entities/validationResult" },
      
      "derived.domainsTransformed": { "type": "integer" },
      "derived.filesGenerated": { "type": "integer" },
      "derived.confidence": { "type": "number" },
      
      "meta.self.attempts": { "type": "integer" }
    },
    
    "intents": {
      "transformDomain": {
        "effect": "transformer:domain:transform",
        "params": { "domain": { "type": "string" } },
        "effects": ["data.transformations.*"]
      },
      "generateSchema": {
        "effect": "transformer:schema:generate",
        "params": { 
          "domain": { "type": "string" },
          "schema": { "type": "object" }
        },
        "effects": ["state.outputs.schemas"]
      },
      "applyCodeChanges": {
        "effect": "transformer:code:apply",
        "params": { "changes": { "type": "array" } },
        "effects": ["state.outputs.codeChanges"]
      },
      "writeDomainFile": {
        "effect": "transformer:file:write",
        "params": { "domain": { "type": "string" } },
        "effects": ["state.outputs.domainFiles"]
      },
      "validate": {
        "effect": "transformer:validate",
        "params": {},
        "effects": ["state.validation"]
      },
      "rollback": {
        "effect": "transformer:rollback",
        "params": { "to": { "type": "string" } },
        "effects": ["data.transformations.*", "state.outputs.*"]
      },
      "reportComplete": {
        "effect": "transformer:complete",
        "params": {},
        "effects": [],
        "emits": ["transformer:done"]
      }
    }
  }
}
```

---

### Validation Integration (Manifesto Core)

Transformer의 validation은 Manifesto Core의 ValidationResult를 직접 사용한다:

```typescript
// From @manifesto-ai/core
interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationSuggestion[];
}

interface ValidationIssue {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  path: string;  // SemanticPath
  location?: SourceLocation;
  suggestion?: string;
}

interface ValidationSuggestion {
  code: string;
  message: string;
  path: string;
  autoFixable: boolean;
  fix?: () => void;
}
```

이로 인해 에이전트가 **자기 행동의 정당성을 의미론적으로 판단**할 수 있다:
- action이 왜 불가능한지
- schema가 왜 모호한지
- domain split이 왜 필요한지

---

## Event System & External Actors

### Event Channels

Reviewer와 같은 외부 Actor는 Domain 외부에서 작동하므로 Event Channel로 통신한다:

```typescript
// Event Channel 정의
const channels = {
  // Orchestrator → Reviewer
  "review:request": {
    payload: {
      source: "analyzer" | "summarizer" | "transformer",
      context: object,
      question: string,
      urgency: "low" | "medium" | "high"
    }
  },
  
  // Reviewer → Orchestrator
  "review:analysis": {
    payload: {
      requestId: string,
      findings: Finding[],
      recommendation: string,
      confidence: number,
      alternatives: Alternative[]
    }
  },
  
  // Agent 완료 알림
  "analyzer:done": { payload: { resultRef: string } },
  "summarizer:done": { payload: { resultRef: string } },
  "transformer:done": { payload: { resultRef: string } },
  
  // 애매한 패턴 발견
  "analyzer:ambiguous": {
    payload: {
      file: string,
      pattern: DetectedPattern,
      suggestedActions: string[]
    }
  }
}
```

### Reviewer Actor (External)

**역할:** 복잡한 패턴 리뷰, 고난도 판단. Manifesto Runtime 외부에서 작동.

```typescript
// Reviewer는 Domain이 아니라 Actor
interface ReviewerActor {
  // Event 수신
  on(channel: "review:request", handler: (payload) => void): void;
  
  // Event 발신
  emit(channel: "review:analysis", payload: ReviewAnalysis): void;
  
  // 내부 상태 (Manifesto 외부)
  state: {
    modelUsed: string;  // Reviewer는 더 강한 모델 사용 가능
    tokensUsed: number;
    requestQueue: ReviewRequest[];
  };
}
```

이 구조로 인해:
- 분산 multi-agent 가능
- 단계적 escalation 가능
- strong/weak model fallback 가능
- HITL 브릿지 가능
- on-demand reasoning 가능

---

## Effect Descriptor System

모든 Intent는 Effect Descriptor 형태로 정규화된다:

```typescript
interface EffectDescriptor {
  // Effect 식별자
  effect: string;  // "orchestrator:delegate", "analyzer:file:analyze"

  // 파라미터
  params: Record<string, unknown>;

  // 메타데이터
  meta: {
    retryable: boolean;
    timeout?: number;
    idempotent: boolean;
    reversible: boolean;
  };

  // 영향받는 상태 경로
  effects: string[];  // SemanticPath[]

  // 발생시키는 이벤트
  emits?: string[];  // Channel[]
}

// 예시
const delegateEffect: EffectDescriptor = {
  effect: "orchestrator:delegate",
  params: { to: "analyzer", task: { type: "batch", paths: [...] } },
  meta: {
    retryable: true,
    timeout: 30000,
    idempotent: false,
    reversible: false
  },
  effects: ["state.children.analyzer"],
  emits: []
};
```

이로 인해:
- **Replay 가능**: Effect 로그만 있으면 상태 재구성
- **Chaining 가능**: Effect → Effect 파이프라인
- **Error Boundary**: Effect 단위로 실패 격리
- **Undo/Redo**: reversible Effect는 역방향 실행 가능
- **Deterministic**: 같은 Effect, 같은 상태 → 같은 결과

---

## Technology Stack

```yaml
Runtime: Node.js >= 18
Language: TypeScript 5.x
Parser: SWC (Rust-based, JSX/TSX 지원)
CLI Framework: Ink (React for CLI)
State Storage: SQLite (로컬 Snapshot 저장)
LLM: OpenAI API (gpt-4o-mini 기본, 동적 업그레이드 가능)
Package Manager: pnpm (모노레포)
Core: @manifesto-ai/core (Runtime, Validation, Event System)
```

---

## Output Specification

### Domain File Format

```
{projectRoot}/
├── manifesto/
│   ├── user.domain.json
│   ├── cart.domain.json
│   ├── checkout.domain.json
│   └── _meta/
│       ├── migration.log.json
│       ├── source-mapping.json
│       └── effect-history.json  # Effect 로그 (replay용)
```

**{domain}.domain.json:**
```json
{
  "$schema": "https://manifesto-ai.dev/schema/domain.v1.json",
  "name": "user",
  "description": "User authentication and profile management",
  "version": "1.0.0",
  "generatedAt": "2024-01-15T10:30:00Z",
  "source": {
    "tool": "@manifesto-ai/react-migrate",
    "version": "1.0.1",
    "files": ["src/hooks/useAuth.ts", "src/contexts/UserContext.tsx"]
  },
  "schema": {
    "entities": {
      "user": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "email": { "type": "string", "format": "email" },
          "profile": { "$ref": "#/entities/profile" }
        },
        "required": ["id", "email"]
      }
    },
    "state": {
      "data.currentUser": { "$ref": "#/entities/user", "nullable": true },
      "state.isAuthenticated": { "type": "boolean" },
      "state.isLoading": { "type": "boolean" }
    },
    "intents": {
      "login": {
        "effect": "user:auth:login",
        "params": {
          "email": { "type": "string" },
          "password": { "type": "string" }
        },
        "effects": ["state.isLoading", "data.currentUser", "state.isAuthenticated"],
        "meta": { "retryable": true, "timeout": 10000 }
      },
      "logout": {
        "effect": "user:auth:logout",
        "params": {},
        "effects": ["data.currentUser", "state.isAuthenticated"],
        "meta": { "retryable": false, "reversible": false }
      }
    }
  }
}
```

---

## CLI Interface

### Commands

```bash
# 기본 실행
npx @manifesto-ai/react-migrate

# 특정 디렉토리
npx @manifesto-ai/react-migrate --root ./src

# 출력 디렉토리 지정
npx @manifesto-ai/react-migrate --output ./manifesto

# 이전 세션 이어하기
npx @manifesto-ai/react-migrate --resume

# 자동 모드 (HITL 최소화, 낮은 confidence도 자동 결정)
npx @manifesto-ai/react-migrate --auto

# 드라이런 (실제 파일 생성 안 함)
npx @manifesto-ai/react-migrate --dry-run

# 상세 로그
npx @manifesto-ai/react-migrate --verbose

# Effect 히스토리 재생 (디버깅용)
npx @manifesto-ai/react-migrate --replay ./manifesto/_meta/effect-history.json
```

### Interactive UI (Ink)

```
┌─────────────────────────────────────────────────────────────┐
│  @manifesto-ai/react-migrate v1.0.1                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase: ANALYZING                                           │
│  Progress: ████████████░░░░░░░░ 62% (186/300 files)        │
│                                                             │
│  Current: src/components/checkout/PaymentForm.tsx           │
│                                                             │
│  Domains identified: 5                                      │
│    ✓ user (23 files, confidence: 0.94)                     │
│    ✓ cart (18 files, confidence: 0.89)                     │
│    ◐ checkout (analyzing...)                               │
│    ○ product (pending)                                     │
│    ○ notification (pending)                                │
│                                                             │
│  Model: gpt-4o-mini | Context: 47% | Attempts: 1           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ⚠ Human input needed:                                     │
│                                                             │
│  File: src/hooks/usePayment.ts                             │
│  Pattern found:                                             │
│    const [state, dispatch] = useReducer(paymentReducer, {})│
│                                                             │
│  This reducer has 12 action types. How should I group them?│
│                                                             │
│  › [1] Single 'payment' domain (all actions together)      │
│    [2] Split: 'payment' + 'paymentValidation' domains      │
│    [3] Show me the reducer code                            │
│    [4] Let me specify manually                             │
│    [5] Skip and mark for manual review                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| 자동 변환율 | ≥ 80% | (자동 처리 파일 / 전체 파일) |
| 스키마 정확도 | 100% | 생성된 스키마가 원본 동작과 일치 |
| 세션 복원 | 100% | 중단 후 재시작 시 진행률 완전 복원 |
| 모델 요구사항 | gpt-4o-mini | 기본 모델로 전체 파이프라인 작동 |
| 처리 속도 | ≤ 1s/file | 평균 파일 처리 시간 |
| HITL 응답 시간 | ≤ 5s | 인간 입력 후 재개까지 |
| Effect Replay | 100% | Effect 로그로 상태 완전 재구성 |

---

## Development Phases

### Phase 1: Foundation (Week 1-2)

- [ ] 모노레포 구조 설정
- [ ] SWC 기반 파서 통합
- [ ] Manifesto Runtime 연동
- [ ] SemanticPath 기반 Snapshot 시스템 구현
- [ ] SQLite 상태 저장소 구현
- [ ] Ink CLI 기본 프레임 구현

### Phase 2: Domains (Week 3-4)

- [ ] Analyzer Domain 구현
    - [ ] Component 패턴 인식
    - [ ] Hook 패턴 인식
    - [ ] Context 패턴 인식
    - [ ] Form 패턴 인식
- [ ] Summarizer Domain 구현
    - [ ] 도메인 경계 식별
    - [ ] 관계 그래프 생성
    - [ ] 스키마 제안 로직
- [ ] Transformer Domain 구현
    - [ ] 스키마 생성
    - [ ] 도메인 파일 출력
    - [ ] Manifesto Validation 연동

### Phase 3: Orchestration (Week 5)

- [ ] Orchestrator Domain 구현
- [ ] Effect Descriptor 시스템 구현
- [ ] Event Channel 시스템 구현
- [ ] HITL 플로우 구현
- [ ] 동적 모델 업그레이드 로직
- [ ] Reviewer Actor 구현

### Phase 4: Polish (Week 6)

- [ ] 에러 핸들링 강화
- [ ] Effect Replay 메커니즘 구현
- [ ] 테스트 커버리지 70%
- [ ] 문서화
- [ ] 샘플 프로젝트 마이그레이션 검증

---

## Risk & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| SWC 파싱 한계 | 일부 패턴 인식 불가 | Medium | HITL fallback, 패턴 DB 확장 |
| 컨텍스트 폭발 | 대규모 코드베이스 처리 불가 | Medium | Snapshot 계층화, 배치 처리 |
| 도메인 경계 애매함 | 잘못된 스키마 생성 | High | HITL 강화, confidence threshold |
| LLM 비용 초과 | 운영 비용 증가 | Low | 캐싱, 배치 최적화, 작은 모델 우선 |
| Event Channel 복잡성 | 디버깅 어려움 | Medium | Effect 로그, 시각화 도구 |

---

## Open Questions

1. **레거시 Class 컴포넌트**: 어디까지 지원할 것인가?
2. **써드파티 상태관리**: Redux, Zustand, Jotai 등 각각의 패턴 인식 필요
3. **테스트 코드**: 테스트 파일도 분석해서 스키마 검증에 활용할 것인가?
4. **점진적 마이그레이션**: 일부 파일만 마이그레이션하는 모드 필요한가?
5. **Effect Versioning**: Effect 스키마가 변경되면 이전 로그와 호환성은?

---

## Appendix: Intent → Effect Mapping Table

| Domain | Intent | Effect |
|--------|--------|--------|
| Orchestrator | startAnalysis | `orchestrator:start` |
| Orchestrator | delegate | `orchestrator:delegate` |
| Orchestrator | requestHitl | `orchestrator:hitl:request` |
| Orchestrator | resolveHitl | `orchestrator:hitl:resolve` |
| Orchestrator | upgradeModel | `orchestrator:model:upgrade` |
| Orchestrator | spawnReviewer | `orchestrator:spawn:reviewer` |
| Analyzer | analyzeFile | `analyzer:file:analyze` |
| Analyzer | analyzeBatch | `analyzer:batch:analyze` |
| Analyzer | markAmbiguous | `analyzer:pattern:ambiguous` |
| Summarizer | summarizeDomain | `summarizer:domain:summarize` |
| Summarizer | proposeSchema | `summarizer:schema:propose` |
| Summarizer | mergeDomains | `summarizer:domain:merge` |
| Transformer | transformDomain | `transformer:domain:transform` |
| Transformer | generateSchema | `transformer:schema:generate` |
| Transformer | validate | `transformer:validate` |
| Transformer | rollback | `transformer:rollback` |

---

## References

- Manifesto Core Specification v1.0
- Manifesto Runtime Documentation
- Manifesto Event System Specification
- SWC Parser Documentation
- Ink CLI Framework
- OpenAI API Reference

---

*Document Version: 1.0.1*
*Last Updated: 2024-01-15*
*Author: 정성우*

---

## Changelog

### v1.0.1 (Current)
- SemanticPath 기반 네임스페이스로 Snapshot 구조 재구성
- Intent를 Effect Descriptor 형태로 정규화
- Validation에 Manifesto Core ValidationResult 통합
- Reviewer를 Event Channel 기반 External Actor로 분리
- Effect Replay 메커니즘 추가
- Intent → Effect 매핑 테이블 추가
- Agent OS 철학 섹션 추가

### v1.0.0
- Initial PRD
