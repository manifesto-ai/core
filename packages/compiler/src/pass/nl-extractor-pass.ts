/**
 * NL Extractor Pass
 *
 * TextArtifact를 처리하여 LLM을 통해 FragmentDraft를 생성합니다.
 *
 * Priority: 900 (독립 실행)
 * Category: nl
 *
 * AGENT_README Invariant #2: LLM은 비신뢰 제안자
 * - Fragment가 아닌 FragmentDraft만 생성
 * - Deterministic Lowering으로 검증 후 Fragment 변환
 */

import type { Artifact, TextArtifact } from '../types/artifact.js';
import { isTextArtifact } from '../types/artifact.js';
import type {
  FragmentDraft,
  SchemaDraft,
  DerivedDraft,
  EffectDraft,
  ActionDraft,
  PolicyDraft,
} from '../types/fragment-draft.js';
import type { Provenance } from '../types/provenance.js';
import type {
  LLMAdapter as SessionLLMAdapter,
  LLMContext as SessionLLMContext,
} from '../types/session.js';
import type {
  NLPass,
  PassContext,
  Finding,
  NLEntityData,
  NLActionData,
  NLConditionData,
} from './base.js';
import { createFindingId } from './base.js';

// ============================================================================
// LLM Adapter Interface (re-exported from session.ts)
// ============================================================================

/**
 * Re-export LLMAdapter from session.ts for backward compatibility
 */
export type LLMAdapter = SessionLLMAdapter;

/**
 * Re-export LLMContext from session.ts for backward compatibility
 */
export type LLMContext = SessionLLMContext;

/**
 * Configuration for NL Pass
 */
export interface NLPassConfig {
  /** LLM adapter to use */
  adapter: LLMAdapter;
  /** Minimum confidence threshold to include drafts */
  minConfidence?: number;
}

// ============================================================================
// Mock LLM Adapter (for testing)
// ============================================================================

/**
 * Simple mock LLM adapter for testing
 *
 * Parses simple patterns from text to create drafts.
 */
export class MockLLMAdapter implements LLMAdapter {
  readonly modelId = 'mock-llm-v1';
  readonly maxConfidence = 0.7;

  async generateDrafts(input: string, context: LLMContext): Promise<FragmentDraft[]> {
    const drafts: FragmentDraft[] = [];
    const provenance = this.createLLMProvenance(input);

    // Parse entity patterns: "X is a Y" or "create X"
    const entityPatterns = [
      /(\w+)\s+is\s+(?:a|an)\s+(\w+)/gi,
      /create\s+(\w+)/gi,
      /add\s+(\w+)/gi,
    ];

    for (const pattern of entityPatterns) {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const name = match[1]?.toLowerCase() ?? 'unknown';
        const type = match[2]?.toLowerCase() ?? 'string';

        drafts.push(this.createSchemaDraft(name, type, provenance));
      }
    }

    // Parse action patterns: "when X, do Y" or "X should Y"
    const actionPatterns = [
      /when\s+(\w+),?\s+(?:do|perform|execute)\s+(\w+)/gi,
      /(\w+)\s+should\s+(\w+)/gi,
      /user\s+can\s+(\w+)/gi,
    ];

    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const verb = match[2] ?? match[1] ?? 'unknown';

        drafts.push(this.createActionDraft(verb.toLowerCase(), provenance));
      }
    }

    // Parse condition patterns: "if X then Y" or "X depends on Y"
    const conditionPatterns = [
      /if\s+(\w+)\s+then\s+(\w+)/gi,
      /(\w+)\s+depends\s+on\s+(\w+)/gi,
      /(\w+)\s+=\s+(\w+)\s*\+\s*(\w+)/gi,
    ];

    for (const pattern of conditionPatterns) {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const subject = match[1]?.toLowerCase() ?? 'x';
        const dependency = match[2]?.toLowerCase() ?? 'y';

        drafts.push(this.createDerivedDraft(subject, [dependency], provenance));
      }
    }

    return drafts;
  }

  private createLLMProvenance(input: string): Provenance {
    return {
      artifactId: 'nl-input',
      location: {
        kind: 'llm',
        model: this.modelId,
        promptHash: this.hashString(input),
      },
    };
  }

  private createSchemaDraft(name: string, type: string, provenance: Provenance): SchemaDraft {
    const schemaType = this.mapTypeToSchemaType(type);
    return {
      kind: 'SchemaFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: [`data.${name}`],
      origin: provenance,
      confidence: 0.6,
      namespace: 'data',
      fields: [
        {
          path: `data.${name}`,
          type: schemaType,
          semantic: {
            type: schemaType,
            description: `${name} field`,
          },
        },
      ],
    };
  }

  private createActionDraft(verb: string, provenance: Provenance): ActionDraft {
    return {
      kind: 'ActionFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: [`action:${verb}`],
      origin: provenance,
      confidence: 0.5,
      actionId: verb,
      semantic: {
        verb,
        description: `${verb} action`,
      },
    };
  }

  private createDerivedDraft(
    name: string,
    deps: string[],
    provenance: Provenance
  ): DerivedDraft {
    return {
      kind: 'DerivedFragment',
      status: 'raw',
      provisionalRequires: deps.map((d) => `data.${d}`),
      provisionalProvides: [`derived.${name}`],
      origin: provenance,
      confidence: 0.5,
      path: `derived.${name}`,
      rawExpr: ['get', `data.${deps[0]}`],
    };
  }

  private mapTypeToSchemaType(type: string): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown' {
    const lower = type.toLowerCase();
    if (lower === 'string' || lower === 'text' || lower === 'name') return 'string';
    if (lower === 'number' || lower === 'integer' || lower === 'count' || lower === 'amount') return 'number';
    if (lower === 'boolean' || lower === 'flag' || lower === 'bool') return 'boolean';
    if (lower === 'object' || lower === 'entity') return 'object';
    if (lower === 'array' || lower === 'list') return 'array';
    return 'unknown';
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

// ============================================================================
// NL Pass Factory
// ============================================================================

/**
 * Create an NL Extractor Pass with the given configuration
 */
export function createNLExtractorPass(config: NLPassConfig): NLPass {
  const { adapter, minConfidence = 0.3 } = config;

  return {
    name: 'nl-extractor',
    priority: 900,
    category: 'nl',

    supports(artifact: Artifact): boolean {
      return isTextArtifact(artifact);
    },

    analyze(ctx: PassContext): Finding[] {
      // For NL pass, we create findings from text parsing
      // These are intermediate representations before LLM processing
      const findings: Finding[] = [];
      const artifact = ctx.artifact as TextArtifact;

      // Split text into sentences/lines for basic analysis
      const lines = artifact.content.split(/[.\n]+/).filter((l) => l.trim().length > 0);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() ?? '';

        // Detect entity mentions
        const entityMatch = /(\w+)\s+is\s+(?:a|an)\s+(\w+)/i.exec(line);
        if (entityMatch) {
          findings.push({
            id: createFindingId('nl-extractor'),
            kind: 'nl_entity',
            passName: 'nl-extractor',
            artifactId: artifact.id,
            data: {
              kind: 'nl_entity',
              name: entityMatch[1]?.toLowerCase() ?? 'unknown',
              description: line,
              inferredType: entityMatch[2]?.toLowerCase(),
              confidence: 0.5,
            } satisfies NLEntityData,
            provenance: {
              artifactId: artifact.id,
              location: {
                kind: 'generated',
                note: `line ${i + 1}: ${line.substring(0, 50)}...`,
              },
            },
          });
        }

        // Detect action mentions
        const actionMatch = /(?:user\s+can|should|will)\s+(\w+)/i.exec(line);
        if (actionMatch) {
          findings.push({
            id: createFindingId('nl-extractor'),
            kind: 'nl_action',
            passName: 'nl-extractor',
            artifactId: artifact.id,
            data: {
              kind: 'nl_action',
              verb: actionMatch[1]?.toLowerCase() ?? 'unknown',
              description: line,
              confidence: 0.5,
            } satisfies NLActionData,
            provenance: {
              artifactId: artifact.id,
              location: {
                kind: 'generated',
                note: `line ${i + 1}: ${line.substring(0, 50)}...`,
              },
            },
          });
        }

        // Detect condition mentions
        const conditionMatch = /if\s+(\w+)/i.exec(line);
        if (conditionMatch) {
          findings.push({
            id: createFindingId('nl-extractor'),
            kind: 'nl_condition',
            passName: 'nl-extractor',
            artifactId: artifact.id,
            data: {
              kind: 'nl_condition',
              subject: conditionMatch[1]?.toLowerCase() ?? 'unknown',
              predicate: 'is true',
              description: line,
              confidence: 0.5,
            } satisfies NLConditionData,
            provenance: {
              artifactId: artifact.id,
              location: {
                kind: 'generated',
                note: `line ${i + 1}: ${line.substring(0, 50)}...`,
              },
            },
          });
        }
      }

      return findings;
    },

    async compile(findings: Finding[], ctx: PassContext): Promise<FragmentDraft[]> {
      const artifact = ctx.artifact as TextArtifact;

      // Build LLM context
      const llmContext: LLMContext = {
        existingPaths: ctx.existingPaths,
        existingFragmentKinds: ctx.existingFragments.map((f) => f.kind),
      };

      // Call LLM adapter
      const drafts = await adapter.generateDrafts(artifact.content, llmContext);

      // Filter by minimum confidence
      return drafts.filter((d) => d.confidence >= minConfidence);
    },
  };
}

// ============================================================================
// Export
// ============================================================================

/**
 * @deprecated Use createNLExtractorPass with explicit LLM adapter.
 * This default instance uses MockLLMAdapter and should only be used for testing.
 *
 * 헌법 제5조 (결정론 경계): LLM 패스는 명시적 opt-in이어야 합니다.
 * 프로덕션에서는 createNLExtractorPass()를 사용하세요.
 */
export const nlExtractorPass = createNLExtractorPass({
  adapter: new MockLLMAdapter(),
  minConfidence: 0.3,
});

// Note: default export removed to encourage explicit opt-in
// 기존: export default nlExtractorPass;
// 변경: createNLExtractorPass를 사용하도록 유도
