/**
 * @fileoverview Deprecated compatibility wrapper for Manifesto export.
 */

import type { IntentGraph } from "@manifesto-ai/translator";
import type { ManifestoBundle, ManifestoExportContext } from "./types.js";
import { manifestoExporter } from "./exporter.js";

/**
 * @deprecated Use exportTo(manifestoExporter, input, ctx) instead.
 */
export async function emitForManifesto(
  graph: IntentGraph,
  ctx: ManifestoExportContext
): Promise<ManifestoBundle>;
export async function emitForManifesto(
  graph: IntentGraph,
  lexicon: ManifestoExportContext["lexicon"],
  resolver: ManifestoExportContext["resolver"]
): Promise<ManifestoBundle>;
export async function emitForManifesto(
  graph: IntentGraph,
  ctxOrLexicon: ManifestoExportContext | ManifestoExportContext["lexicon"],
  resolver?: ManifestoExportContext["resolver"]
): Promise<ManifestoBundle> {
  if ("lexicon" in ctxOrLexicon) {
    return manifestoExporter.export({ graph }, ctxOrLexicon);
  }

  if (!resolver) {
    throw new Error("emitForManifesto requires resolver when lexicon is provided directly.");
  }

  return manifestoExporter.export({ graph }, { lexicon: ctxOrLexicon, resolver });
}
