/**
 * Retrieval Indexer
 * Builds lunr.js index from schema and glossary
 */

import lunr from "lunr";
import type { GlossaryEntry } from "../types/index.js";
import type { SchemaInfo, RetrievalIndex } from "./types.js";

/**
 * Build alias table from glossary
 */
export function buildAliasTable(
  glossary: GlossaryEntry[],
  schemaInfo: SchemaInfo
): Map<string, string[]> {
  const aliasTable = new Map<string, string[]>();

  // Helper to add alias -> paths mapping
  const addAlias = (alias: string, paths: string[]) => {
    const normalizedAlias = alias.toLowerCase().trim();
    if (!normalizedAlias) return;

    const existing = aliasTable.get(normalizedAlias) || [];
    const newPaths = [...new Set([...existing, ...paths])];
    aliasTable.set(normalizedAlias, newPaths);
  };

  // Build paths by field name
  const fieldNameToPaths = new Map<string, string[]>();
  for (const path of Object.keys(schemaInfo.fields)) {
    const field = schemaInfo.fields[path];
    const name = field.name.toLowerCase();
    const existing = fieldNameToPaths.get(name) || [];
    fieldNameToPaths.set(name, [...existing, path]);
  }

  // Process glossary entries
  for (const entry of glossary) {
    // Get paths for this glossary entry
    let paths: string[] = [];

    // Use anchor hints if available
    if (entry.anchorHints && entry.anchorHints.length > 0) {
      paths = [...entry.anchorHints];
    } else {
      // Otherwise, find paths by canonical name
      const canonicalPaths = fieldNameToPaths.get(entry.canonical.toLowerCase());
      if (canonicalPaths) {
        paths = [...canonicalPaths];
      }
    }

    if (paths.length === 0) continue;

    // Add canonical as alias
    addAlias(entry.canonical, paths);

    // Add all language aliases
    for (const lang of Object.keys(entry.aliases)) {
      const aliases = entry.aliases[lang];
      for (const alias of aliases) {
        addAlias(alias, paths);
      }
    }
  }

  return aliasTable;
}

/**
 * Build lunr.js index from schema and glossary
 */
export function buildIndex(
  schemaInfo: SchemaInfo,
  glossary: GlossaryEntry[]
): RetrievalIndex {
  const aliasTable = buildAliasTable(glossary, schemaInfo);

  // Build field name to paths mapping
  const fieldNameToPath = new Map<string, string[]>();
  for (const path of Object.keys(schemaInfo.fields)) {
    const field = schemaInfo.fields[path];
    const name = field.name.toLowerCase();
    const existing = fieldNameToPath.get(name) || [];
    fieldNameToPath.set(name, [...existing, path]);
  }

  // Build lunr index
  const lunrIndex = lunr(function () {
    // Configure fields
    this.ref("path");
    this.field("name", { boost: 10 });
    this.field("description", { boost: 5 });
    this.field("aliases", { boost: 8 });

    // Disable stemming for better exact matching
    this.pipeline.remove(lunr.stemmer);
    this.searchPipeline.remove(lunr.stemmer);

    // Add documents
    for (const path of Object.keys(schemaInfo.fields)) {
      const field = schemaInfo.fields[path];

      // Collect aliases for this path
      const aliases: string[] = [];
      for (const [alias, paths] of aliasTable.entries()) {
        if (paths.includes(path)) {
          aliases.push(alias);
        }
      }

      this.add({
        path,
        name: field.name,
        description: field.description || "",
        aliases: aliases.join(" "),
      });
    }
  });

  return {
    lunrIndex,
    aliasTable,
    schemaInfo,
    fieldNameToPath,
  };
}
