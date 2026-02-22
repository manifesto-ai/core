/**
 * Location mapping helpers for compile-mel-patch synthetic wrapper diagnostics.
 */

import type { Diagnostic } from "../diagnostics/types.js";

export const SYNTHETIC_PATCH_PREFIX_LINES = 3;
export const SYNTHETIC_PATCH_PREFIX_COLUMNS = 6;

export function computeLineStartOffsets(lines: string[]): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return offsets;
}

export function makePatchLocationMapper(
  patchLines: string[],
  patchLineStarts: number[]
): (location: Diagnostic["location"]) => Diagnostic["location"] {
  return (location) => remapLocationToPatchSource(location, patchLines, patchLineStarts);
}

export function remapDiagnosticsToPatchSource(
  diagnostics: Diagnostic[],
  patchLines: string[],
  patchLineStarts: number[]
): Diagnostic[] {
  return diagnostics.map((diagnostic) => remapDiagnosticToPatchSource(
    diagnostic,
    patchLines,
    patchLineStarts
  ));
}

function remapDiagnosticToPatchSource(
  diagnostic: Diagnostic,
  patchLines: string[],
  patchLineStarts: number[]
): Diagnostic {
  return {
    ...diagnostic,
    location: remapLocationToPatchSource(
      diagnostic.location,
      patchLines,
      patchLineStarts
    ),
  };
}

function remapLocationToPatchSource(
  location: Diagnostic["location"],
  patchLines: string[],
  patchLineStarts: number[]
): Diagnostic["location"] {
  return {
    ...location,
    start: remapPositionToPatchSource(location.start, patchLines, patchLineStarts),
    end: remapPositionToPatchSource(location.end, patchLines, patchLineStarts),
  };
}

function remapPositionToPatchSource(
  position: Diagnostic["location"]["start"],
  patchLines: string[],
  patchLineStarts: number[]
): Diagnostic["location"]["start"] {
  const patchLine = position.line - SYNTHETIC_PATCH_PREFIX_LINES;
  const patchLineCount = patchLines.length;
  const clampedPatchLine = Math.min(Math.max(patchLine, 1), patchLineCount);

  const sourceLineStart = patchLineStarts[clampedPatchLine - 1] ?? 0;
  const sourceLineText = patchLines[clampedPatchLine - 1] ?? "";
  const maxSourceColumn = Math.max(sourceLineText.length + 1, 1);
  const sourceColumn = Math.min(
    Math.max(position.column - SYNTHETIC_PATCH_PREFIX_COLUMNS, 1),
    maxSourceColumn
  );

  return {
    line: clampedPatchLine,
    column: sourceColumn,
    offset: Math.max(sourceLineStart + sourceColumn - 1, 0),
  };
}
