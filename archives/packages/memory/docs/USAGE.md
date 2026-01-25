# Memory Package Usage Guide

> **Version:** 1.0.0
> **Status:** Final
> **Spec:** SPEC-1.2v

## Overview

`@manifesto-ai/memory` 패키지는 과거 World/Snapshot 정보를 검색하고 사용하는 4-Layer Architecture를 제공합니다.

**핵심 원칙:**
- Memory ≠ Truth (참조된 World만이 진실)
- Selection은 비결정적이지만 반드시 Trace됨
- Verifier는 반드시 순수함수

## Installation

```bash
pnpm add @manifesto-ai/memory @manifesto-ai/world
```

## Quick Start

### 1. Store와 Verifier 설정

```typescript
import {
  InMemoryStore,
  createExistenceVerifier,
  createSimpleSelector,
} from "@manifesto-ai/memory";

// 테스트용 in-memory store (프로덕션에서는 DB 구현 필요)
const store = new InMemoryStore();

// Verifier 선택 (Existence, Hash, or Merkle)
const verifier = createExistenceVerifier();

// Selector 설정
const selector = createSimpleSelector(store, verifier);
```

### 2. World 인덱싱

```typescript
// World를 저장하고 인덱싱
store.put(world);
selector.addToIndex(world.worldId, ["keyword1", "keyword2"], world.createdAt);
```

### 3. Memory 선택

```typescript
import { createMemoryTrace } from "@manifesto-ai/memory";
import type { ActorRef } from "@manifesto-ai/world";

const actor: ActorRef = { actorId: "agent-1", kind: "agent" };

// Memory 선택
const result = await selector.select({
  query: "relevant keywords",
  atWorldId: currentWorld.worldId,
  selector: actor,
  constraints: {
    maxResults: 5,
    minConfidence: 0.7,
    requireVerified: true,
  },
});

// MemoryTrace 생성
const trace = createMemoryTrace(
  actor,
  "relevant keywords",
  currentWorld.worldId,
  result.selected
);
```

### 4. Proposal에 첨부

```typescript
import { attachToProposal } from "@manifesto-ai/memory";
import { createProposal } from "@manifesto-ai/world";

// Proposal 생성
const proposal = createProposal(actor, intentInstance, baseWorldId);

// MemoryTrace 첨부
const proposalWithMemory = attachToProposal(proposal, trace);

// World Protocol에 제출
await world.submitProposal(proposalWithMemory);
```

---

## World Protocol Integration

### Module Boundaries (SPEC §9)

| 모듈 | Store | prove() | verifyProof() | Selector |
|------|-------|---------|---------------|----------|
| **Actor** | ✅ | ✅ | ✅ | ✅ |
| **Projection** | ❌ | ❌ | ❌ | ❌ |
| **Authority** | ❌ | ❌ | ✅ | ❌ |
| **Host** | ❌ | ❌ | ❌ | ❌ |
| **Core** | ❌ | ❌ | ❌ | ❌ |

### Authority에서 Memory 검증

Authority는 `verifyProof()`만 사용 가능합니다 (M-4, M-12).

```typescript
import {
  getFromProposal,
  extractProof,
  createMerkleVerifier,
} from "@manifesto-ai/memory";
import type { AuthorityHandler } from "@manifesto-ai/world";

// Memory-aware Authority Handler
const memoryAwareHandler: AuthorityHandler = {
  async evaluate(proposal, binding) {
    // 1. MemoryTrace 추출
    const memoryTrace = getFromProposal(proposal);

    if (!memoryTrace) {
      // Memory 미사용 proposal - 기본 처리
      return { approved: true, reason: "No memory used" };
    }

    // 2. Memory 정책 검증
    const verifier = createMerkleVerifier();
    const failures: string[] = [];

    for (const memory of memoryTrace.selected) {
      // 신뢰도 검사
      if (memory.confidence < 0.7) {
        failures.push(`Low confidence: ${memory.confidence}`);
        continue;
      }

      // Evidence가 있으면 검증
      if (memory.evidence) {
        // M-12: Evidence에서 Proof 추출
        const proof = extractProof(memory.evidence);

        // verifyProof() 호출 (Authority 허용)
        const valid = verifier.verifyProof(proof);

        if (!valid) {
          failures.push(`Invalid proof for ${memory.ref.worldId}`);
        }
      }
    }

    if (failures.length > 0) {
      return {
        approved: false,
        reason: `Memory verification failed: ${failures.join(", ")}`,
      };
    }

    return {
      approved: true,
      reason: "Memory verification passed",
    };
  },
};
```

---

## Production Implementation

### Custom MemoryStore (PostgreSQL 예시)

```typescript
import type { MemoryStore } from "@manifesto-ai/memory";
import type { World, WorldId } from "@manifesto-ai/world";
import { Pool } from "pg";

export class PostgresMemoryStore implements MemoryStore {
  constructor(private pool: Pool) {}

  async get(worldId: WorldId): Promise<World | null> {
    const result = await this.pool.query(
      "SELECT data FROM worlds WHERE id = $1",
      [worldId]
    );
    return result.rows[0]?.data ?? null;
  }

  async exists(worldId: WorldId): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT 1 FROM worlds WHERE id = $1 LIMIT 1",
      [worldId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
```

### Custom MemorySelector (LLM 기반 예시)

```typescript
import type {
  MemorySelector,
  SelectionRequest,
  SelectionResult,
  SelectedMemory,
  MemoryStore,
  MemoryVerifier,
  VerificationEvidence,
} from "@manifesto-ai/memory";

export class LLMMemorySelector implements MemorySelector {
  constructor(
    private store: MemoryStore,
    private verifier: MemoryVerifier,
    private llm: LLMClient,
    private vectorIndex: VectorIndex
  ) {}

  async select(request: SelectionRequest): Promise<SelectionResult> {
    const selectedAt = Date.now();

    // 1. Vector search로 후보 검색
    const candidates = await this.vectorIndex.search(request.query, 20);

    // 2. LLM으로 관련성 재평가
    const ranked = await this.llm.rankByRelevance(
      request.query,
      candidates
    );

    // 3. 검증 및 Evidence 생성
    const selected: SelectedMemory[] = await Promise.all(
      ranked.map(async (candidate) => {
        const world = await this.store.get(candidate.worldId);

        const proveResult = world
          ? this.verifier.prove({ worldId: candidate.worldId }, world)
          : { valid: false, error: "World not found" };

        const evidence: VerificationEvidence | undefined = proveResult.proof
          ? {
              method: proveResult.proof.method,
              proof: proveResult.proof.proof,
              verifiedAt: selectedAt,
              verifiedBy: request.selector, // Selector가 Evidence 생성
            }
          : undefined;

        return {
          ref: { worldId: candidate.worldId },
          reason: candidate.reason,
          confidence: candidate.score,
          verified: proveResult.valid,
          evidence,
        };
      })
    );

    // 4. 제약조건 적용
    let filtered = selected;

    if (request.constraints?.requireVerified) {
      filtered = filtered.filter((m) => m.verified);
    }

    if (request.constraints?.minConfidence !== undefined) {
      filtered = filtered.filter(
        (m) => m.confidence >= request.constraints!.minConfidence!
      );
    }

    return { selected: filtered, selectedAt };
  }
}
```

---

## Verifier Selection Guide

| Verifier | 복잡도 | 보안 수준 | 사용 사례 |
|----------|--------|----------|----------|
| **ExistenceVerifier** | 낮음 | 낮음 | 개발/테스트, 신뢰된 환경 |
| **HashVerifier** | 중간 | 중간 | 일반적인 프로덕션 |
| **MerkleVerifier** | 높음 | 높음 | 감사 필요, 규정 준수 |

---

## Forbidden Patterns

```typescript
// ❌ Projection에서 Memory 접근 (M-10)
const projection = (event) => {
  const memories = await selector.select(...); // FORBIDDEN!
};

// ❌ Authority에서 Store 접근
const authority = {
  evaluate(proposal) {
    const world = await store.get(worldId); // FORBIDDEN!
  }
};

// ❌ Authority에서 prove() 호출
const authority = {
  evaluate(proposal) {
    const proof = verifier.prove(ref, world); // FORBIDDEN!
  }
};

// ❌ Verifier에서 IO 수행 (M-8)
class BadVerifier implements MemoryVerifier {
  prove(memory, world) {
    const data = await fetch(...); // FORBIDDEN!
    const now = Date.now(); // FORBIDDEN!
    return { valid: true, proof: { method: "bad", verifiedAt: now } };
  }
}
```

---

## Complete Example

```typescript
import {
  InMemoryStore,
  createMerkleVerifier,
  createSimpleSelector,
  createMemoryTrace,
  attachToProposal,
  getFromProposal,
  extractProof,
} from "@manifesto-ai/memory";
import {
  createManifestoWorld,
  createProposal,
  createActorRef,
} from "@manifesto-ai/world";

// === Setup ===
const store = new InMemoryStore();
const verifier = createMerkleVerifier();
const selector = createSimpleSelector(store, verifier);

// === Actor Flow ===
async function actorFlow() {
  const actor = createActorRef("agent-1", "agent");
  const currentWorldId = "world-current";

  // 1. Memory 선택
  const result = await selector.select({
    query: "previous decisions about pricing",
    atWorldId: currentWorldId as any,
    selector: actor,
    constraints: {
      maxResults: 3,
      minConfidence: 0.8,
      requireVerified: true,
    },
  });

  // 2. MemoryTrace 생성
  const trace = createMemoryTrace(
    actor,
    "previous decisions about pricing",
    currentWorldId as any,
    result.selected
  );

  // 3. Proposal 생성 및 Memory 첨부
  const proposal = createProposal(actor, intentInstance, currentWorldId as any);
  const proposalWithMemory = attachToProposal(proposal, trace);

  return proposalWithMemory;
}

// === Authority Flow ===
async function authorityFlow(proposal: Proposal) {
  // 1. MemoryTrace 추출
  const trace = getFromProposal(proposal);

  if (!trace) {
    return { approved: true };
  }

  // 2. 각 Memory 검증
  for (const memory of trace.selected) {
    if (memory.evidence) {
      // M-12: Proof 추출
      const proof = extractProof(memory.evidence);

      // verifyProof만 호출 가능
      const valid = verifier.verifyProof(proof);

      if (!valid) {
        return { approved: false, reason: "Memory verification failed" };
      }
    }
  }

  return { approved: true };
}
```
