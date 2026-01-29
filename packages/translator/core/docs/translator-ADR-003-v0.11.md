# ADR-TRANSLATOR-003: Decompose Layer — Composable Pre-pass for Extreme Complexity

> **Status:** Accepted  
> **Version:** 0.1.1  
> **Date:** 2026-01-26 (Updated: 2026-01-27)  
> **Deciders:** Manifesto Architecture Team  
> **Scope:** Translator consumer pipeline (pre-translate stage)  
> **Companion:** ADR-TRANSLATOR-001, ADR-TRANSLATOR-002  
> **Does NOT Change:** Intent IR v0.1, Intent Graph model, emitForManifesto contract

---

## Context

Extreme complex inputs (very long, multi-part, mixed conditions, implicit discourse) cause single-pass translation to degrade toward 0% accuracy due to:
- Global coherence loss (slot drop, OR→AND collapse, dependency omission)
- Excessive cognitive load during one-shot graph construction

We want a solution that:
1. Is language-independent
2. Does not require a hierarchical graph redesign
3. Keeps Translator core unchanged
4. Allows users to compose strategies based on runtime constraints (no-LLM env, low-cost env, etc.)

---

## Decision

### D1. Introduce a Decompose Layer as an OPTIONAL, composable pre-pass

A Decompose Layer MAY be applied before `translate()` to split input into chunks:

```
text
  → decompose(text) => chunks[]
  → for each chunk: translate(chunk) + validate(chunkGraph)
  → merge(chunkGraphs) => mergedGraph
  → validate(mergedGraph)
```

**Normative:**
- Decompose is a pipeline concern, not Translator core responsibility.
- Translator core does NOT depend on Decompose.
- Decompose is consumer-composed (App/Agent/UI chooses and wires strategies).

---

### D2. Decompose is defined by a strategy interface (contract), not by a single implementation

```typescript
interface DecomposeStrategy {
  decompose(input: string, ctx?: DecomposeContext): DecomposeResult;
}

type DecomposeContext = {
  /** Language hint (MUST NOT be required) */
  language?: string;
  /** Soft budget for chunk size */
  maxChunkChars?: number;
  /** Soft budget for number of chunks */
  maxChunks?: number;
};

type DecomposeResult = {
  chunks: Array<{
    /** Unique chunk identifier */
    id: string;
    /** MUST be contiguous substring of input */
    text: string;
    /** OPTIONAL: offsets in original string */
    span?: [number, number];
    /** OPTIONAL: non-normative hints for downstream */
    hint?: Record<string, unknown>;
  }>;
  warnings?: Array<{ code: string; message: string }>;
};
```

**Normative Chunk Constraints:**

| ID | Level | Constraint |
|----|-------|------------|
| **C-DEC-1** | MUST | Each `chunk.text` MUST be a contiguous substring of `input`. (No paraphrasing, no novel tokens.) |
| **C-DEC-2** | MUST | Chunks MUST preserve original order (by span start). |
| **C-DEC-3** | SHOULD | Chunks SHOULD form a non-overlapping cover of the input. |
| **C-DEC-4** | MAY | Chunks MAY overlap for context continuity. See **Overlap Warning** below. |
| **C-DEC-5** | MUST (LLM) | LLM-based strategies MUST include `span: [start, end]` and verify `input.slice(start, end) === chunk.text`. Verification failure MUST trigger fallback or error. |
| **C-DEC-6** | MUST (if overlap) | If overlapping chunks are used, consumer MUST implement deduplication before execution. |

**⚠️ Overlap Warning (C-DEC-4 + C-DEC-6):**

Overlapping chunks create a **duplicate execution risk**:
- The same sentence/command may appear in multiple chunks
- translate() will generate duplicate intents (one per chunk)
- merge() does NOT deduplicate (it only prefixes IDs and adds dependencies)
- Without explicit deduplication, the same action may execute multiple times

**When overlap MAY be acceptable:**
- Overlap is used ONLY for context (e.g., first sentence of chunk N = last sentence of chunk N-1)
- Consumer marks "context-only" spans that should NOT generate nodes
- Consumer implements semantic deduplication post-merge

**v0.1 Recommendation:**
For v0.1, prefer **non-overlapping decompose** (C-DEC-3). If overlap is needed:
1. Keep overlap minimal (1-2 sentences for context)
2. Implement deduplication based on span overlap detection
3. Or use "context prefix" pattern: chunk.contextSpan vs chunk.primarySpan

**Rationale:**
- C-DEC-1..4: Keep decompose language-independent and meaning-preserving; ensure deterministic merge and traceability.
- C-DEC-5: LLM output is non-deterministic. Span verification is the only reliable way to ensure substring constraint.
- C-DEC-6: Overlap without dedup leads to duplicate execution, which is a silent correctness bug.

---

### D3. Provide reference implementations, but do not mandate them

#### D3-1. DeterministicDecompose (reference impl)

- Splits by punctuation boundaries + length budget (no language keywords)
- Fallback when LLM is unavailable or cost-constrained
- Example heuristics:
    - Split on sentence-ending punctuation (`.`, `!`, `?`, `。`, `！`, `？`)
    - Split on clause separators (`;`, `:`, `、`)
    - Enforce `maxChunkChars` as hard limit

```typescript
class DeterministicDecompose implements DecomposeStrategy {
  decompose(input: string, ctx?: DecomposeContext): DecomposeResult {
    const maxChars = ctx?.maxChunkChars ?? 500;
    const chunks = splitByPunctuation(input, maxChars);
    return { chunks };
  }
}
```

#### D3-2. ShallowLLMDecompose (reference impl; "Method A")

- Uses an LLM/SLM for **boundary tagging only**, NOT intent generation
- Output MUST still satisfy C-DEC-1..4 (substrings only)
- Prompt forbids paraphrase and forbids semantic reasoning beyond boundary detection

**Example Prompt:**
```
You are a text segmentation assistant.
Given an input text, identify logical breakpoints where the text can be split
into independent or semi-independent command chunks.

RULES:
1. Output ONLY the span indices [start, end] for each chunk
2. DO NOT paraphrase or summarize
3. DO NOT analyze intent or meaning
4. Chunks must be contiguous and cover the entire input

Input: "{input}"

Output format: [{"start": 0, "end": 45}, {"start": 46, "end": 120}, ...]
```

**Normative requirements for LLM-based strategy:**

| ID | Level | Constraint |
|----|-------|------------|
| **C-LLM-DEC-1** | MUST | LLM decompose output MUST be verifiable against substring spans. |
| **C-LLM-DEC-2** | MUST | If verification fails, implementation MUST fall back to deterministic splitting or raise `DecomposeError`. |

---

### D4. Merge is graph-level and does not introduce hierarchical nodes

Merge combines chunk graphs into a single Intent Graph without new node kinds.

**Normative:**

| ID | Level | Constraint |
|----|-------|------------|
| **C-MERGE-1** | MUST | Node IDs MUST be made globally unique (e.g., prefix by chunk id). |
| **C-MERGE-2** | MUST | Each chunk graph MUST remain internally valid (DAG, invariants). |
| **C-MERGE-3** | MUST | The merged graph MUST remain a DAG; if merge introduces a cycle, merge MUST fail. |
| **C-MERGE-4** | SHOULD | If decompose implies sequential execution, consumer MAY add conservative cross-chunk dependencies. |

**Conservative Merge Strategy (default recommended):**

```typescript
function conservativeMerge(chunkGraphs: IntentGraph[]): IntentGraph {
  const allNodes: IntentNode[] = [];
  
  for (let i = 0; i < chunkGraphs.length; i++) {
    const chunk = chunkGraphs[i];
    const prefix = `c${i}_`;
    
    // Prefix all node IDs for uniqueness (C-MERGE-1)
    const prefixedNodes = chunk.nodes.map(n => ({
      ...n,
      id: prefix + n.id,
      dependsOn: n.dependsOn.map(d => prefix + d)
    }));
    
    // Add cross-chunk dependencies (C-MERGE-4)
    // IMPORTANT: Exclude Abstract leaves to comply with C-ABS-1
    if (i > 0) {
      const prevChunk = chunkGraphs[i - 1];
      const prevExecutableLeaves = findLeaves(prevChunk)
        .filter(n => n.resolution.status !== "Abstract")  // C-ABS-1 compliance
        .map(n => `c${i-1}_${n.id}`);
      const currRoots = findRoots(chunk)
        .filter(n => n.resolution.status !== "Abstract");  // Only executable roots need deps
      
      for (const root of currRoots) {
        const prefixedRoot = prefixedNodes.find(n => n.id === prefix + root.id)!;
        prefixedRoot.dependsOn.push(...prevExecutableLeaves);
      }
    }
    
    allNodes.push(...prefixedNodes);
  }
  
  return { nodes: allNodes };
}
```

> **Note:** Conservative merge adds "all executable roots of chunk k+1 depend on all executable leaves of chunk k". Abstract nodes are excluded from cross-chunk linking to comply with C-ABS-1 (non-Abstract nodes cannot depend on Abstract nodes).

---

### D5. Language independence requirement

Decompose strategies MUST NOT require language-specific keyword lists as a hard dependency.

**Normative:**

| ID | Level | Constraint |
|----|-------|------------|
| **C-LANG-1** | MUST | Decompose MUST work without language-specific grammar rules. |
| **C-LANG-2** | MAY | Language hints MAY be used as soft heuristics, never as correctness requirements. |

**Rationale:** Translator already handles multi-language input (한국어, English, etc.). Decompose must not regress this capability.

---

## Consequences

### Positive

- Extreme complex inputs degrade into "partial success + localized failure" rather than "global collapse"
- No changes to Intent Graph type system or Translator core contracts
- Users can compose deterministic vs LLM-assisted strategies based on cost/policy constraints
- Pipeline is testable at each stage (decompose, translate, merge)

### Negative / Tradeoffs

- Pipeline complexity increases (multiple translate/validate calls)
- Conservative merge dependencies can serialize too much (correctness-first tradeoff)
- Additional latency from multiple LLM calls (if using LLM decompose + LLM translate)

---

## Open Questions

1. **Default merge policy:** Conservative serial vs minimal edges?
2. **Escalation policy:** When to switch from deterministic decompose to LLM decompose?
3. **Warning propagation:** How to surface decompose warnings through Translator warnings channel?
4. **Chunk hint usage:** Should translate() accept chunk hints for disambiguation?

---

## References

- ADR-TRANSLATOR-001: Intent Graph model (unchanged)
- ADR-TRANSLATOR-002: Output artifacts (unchanged)
- Intent IR v0.1: Node structure (unchanged)
- Evaluation Report: "다단계 의존성" test case showed dependency chain issues with 4+ steps
