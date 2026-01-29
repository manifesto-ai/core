/**
 * @fileoverview JSON target types.
 */

export interface JsonOutput {
  readonly nodes: Array<{
    id: string;
    event: unknown;
    resolution: string;
    dependencies: string[];
  }>;
  readonly edges: Array<{ from: string; to: string }>;
}
