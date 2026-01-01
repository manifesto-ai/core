/**
 * @manifesto-ai/compiler v1.1 Emitter
 *
 * Emits the final DomainSpec from a verified DomainDraft.
 * Per SPEC §11.4: Emitter produces immutable output.
 */

import { nanoid } from "nanoid";
import type {
  DomainDraft,
  DomainSpec,
  DomainSpecProvenance,
  DomainSpecVerification,
  Issue,
} from "../domain/types.js";
import type { VerifyResult } from "./verifier.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Emit Context
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for the Emitter
 */
export interface EmitContext {
  /**
   * Compiler version
   */
  compilerVersion: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 Emit Result
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of emission
 */
export type EmitResult =
  | { ok: true; domainSpec: DomainSpec }
  | { ok: false; reason: string };

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Hash Computation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute a content hash for the domain spec
 *
 * Uses a simple hash for now - can be replaced with a cryptographic hash.
 */
function computeContentHash(assembled: DomainDraft["assembled"]): string {
  const content = JSON.stringify(assembled, null, 0);

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
  }

  // Convert to hex and ensure positive
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Generate version string
 *
 * Format: YYYYMMDD.HHMMSS.XXXX
 */
function generateVersion(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const rand = nanoid(4);
  return `${date}.${time}.${rand}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 Schema Extraction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract CoreDomainSchema from assembled structure
 *
 * This converts the assembled structure to the format expected by @manifesto-ai/core.
 */
function extractSchema(assembled: DomainDraft["assembled"]): unknown {
  return {
    state: assembled.state,
    computed: assembled.computed,
    actions: assembled.actions,
    constraints: assembled.constraints,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 Emitter Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emitter - produces final DomainSpec
 *
 * Per SPEC §11.4: Emitter produces immutable output.
 *
 * Responsibilities:
 * - Verify that verification passed
 * - Compute content hash
 * - Generate version
 * - Create immutable DomainSpec
 */
export interface Emitter {
  /**
   * Emit a DomainSpec from a verified DomainDraft
   */
  emit(draft: DomainDraft, verification: VerifyResult, context: EmitContext): EmitResult;
}

/**
 * Create the Emitter
 */
export function createEmitter(): Emitter {
  return {
    emit(draft: DomainDraft, verification: VerifyResult, context: EmitContext): EmitResult {
      // Step 1: Check verification passed
      if (!verification.valid) {
        const errorCount = verification.issues.filter((i) => i.severity === "error").length;
        return {
          ok: false,
          reason: `Verification failed with ${errorCount} errors`,
        };
      }

      // Step 2: Compute content hash
      const hash = computeContentHash(draft.assembled);

      // Step 3: Generate version
      const version = generateVersion();

      // Step 4: Extract schema
      const schema = extractSchema(draft.assembled);

      // Step 5: Create provenance
      const provenance: DomainSpecProvenance = {
        sourceInputId: draft.sourceInputId,
        planId: draft.planId,
        fragmentIds: draft.fragments.map((f) => f.id),
        compiledAt: Date.now(),
        compilerVersion: context.compilerVersion,
      };

      // Step 6: Create verification record
      const verificationRecord: DomainSpecVerification = {
        valid: true as const,
        issues: verification.issues.filter((i) => i.severity !== "error") as Issue[],
      };

      // Step 7: Create DomainSpec
      const domainSpec: DomainSpec = {
        id: `spec_${nanoid(8)}`,
        version,
        hash,
        schema,
        provenance,
        verification: verificationRecord,
      };

      return { ok: true, domainSpec };
    },
  };
}

/**
 * Emitter version
 */
export const EMITTER_VERSION = "1.1.0";

/**
 * Compiler version
 */
export const COMPILER_VERSION = "1.1.0";
