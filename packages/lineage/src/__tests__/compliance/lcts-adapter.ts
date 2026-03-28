import * as lineage from "../../index.js";
import type { LineageComplianceAdapter } from "./lcts-types.js";

export class LegacyWorldBackedLineageComplianceAdapter implements LineageComplianceAdapter {
  async computeSnapshotHash(snapshot: Parameters<typeof lineage.computeSnapshotHash>[0]): Promise<string> {
    return lineage.computeSnapshotHash(snapshot);
  }

  async computeWorldId(schemaHash: string, snapshotHash: string): Promise<string> {
    return lineage.computeWorldId(schemaHash, snapshotHash);
  }

  createMemoryStore(): unknown {
    return lineage.createMemoryWorldStore();
  }

  exports(): Record<string, unknown> {
    return lineage;
  }
}

export function createLineageComplianceAdapter(): LineageComplianceAdapter {
  return new LegacyWorldBackedLineageComplianceAdapter();
}
