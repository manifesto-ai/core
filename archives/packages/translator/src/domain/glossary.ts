/**
 * Glossary Types (SPEC-1.1.1v §7)
 *
 * Glossary provides stable semantic anchoring for multilingual inputs.
 */

import { z } from "zod";
import type { SemanticPath } from "./types.js";

// =============================================================================
// GlossaryEntry (§7.2)
// =============================================================================

/**
 * A single glossary entry
 *
 * Maps aliases in multiple languages to a canonical semantic identifier.
 */
export interface GlossaryEntry {
  /** Unique semantic identifier (e.g., "op.gte", "field.user.email") */
  semanticId: string;
  /** Canonical English representation */
  canonical: string;
  /** Aliases by language code (e.g., { en: [...], ko: [...] }) */
  aliases: Record<string, string[]>;
  /** Hints for anchoring to schema paths */
  anchorHints?: SemanticPath[];
  /** Part of speech */
  pos?: "noun" | "verb" | "adj" | "adv";
  /** Where this entry came from */
  provenance?: "builtin" | "project" | "user";
}

export const GlossaryEntrySchema = z.object({
  semanticId: z.string(),
  canonical: z.string(),
  aliases: z.record(z.array(z.string())),
  anchorHints: z.array(z.string()).optional(),
  pos: z.enum(["noun", "verb", "adj", "adv"]).optional(),
  provenance: z.enum(["builtin", "project", "user"]).optional(),
});

// =============================================================================
// Glossary (§7.3)
// =============================================================================

/**
 * Complete glossary for normalization
 *
 * Entries are indexed by semanticId for lookup.
 */
export interface Glossary {
  /** Glossary entries indexed by semanticId */
  entries: Record<string, GlossaryEntry>;
  /** Supported languages */
  languages: string[];
  /** Glossary version */
  version?: string;
}

export const GlossarySchema = z.object({
  entries: z.record(GlossaryEntrySchema),
  languages: z.array(z.string()),
  version: z.string().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create an empty glossary
 */
export function createEmptyGlossary(): Glossary {
  return {
    entries: {},
    languages: ["en"],
  };
}

/**
 * Add an entry to a glossary
 */
export function addGlossaryEntry(
  glossary: Glossary,
  entry: GlossaryEntry
): Glossary {
  return {
    ...glossary,
    entries: {
      ...glossary.entries,
      [entry.semanticId]: entry,
    },
  };
}

/**
 * Look up a term in the glossary
 *
 * Returns the entry if found, or undefined.
 */
export function lookupTerm(
  glossary: Glossary,
  term: string,
  language?: string
): GlossaryEntry | undefined {
  const normalizedTerm = term.toLowerCase().trim();

  for (const entry of Object.values(glossary.entries)) {
    // Check canonical
    if (entry.canonical.toLowerCase() === normalizedTerm) {
      return entry;
    }

    // Check aliases
    const languagesToCheck = language ? [language] : Object.keys(entry.aliases);
    for (const lang of languagesToCheck) {
      const aliases = entry.aliases[lang] ?? [];
      if (aliases.some((a) => a.toLowerCase() === normalizedTerm)) {
        return entry;
      }
    }
  }

  return undefined;
}
