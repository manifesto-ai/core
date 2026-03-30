import * as lineage from "../../index.js";
import type { LineageComplianceAdapter } from "./lcts-types.js";

export class SplitNativeLineageComplianceAdapter implements LineageComplianceAdapter {
  async computeSnapshotHash(snapshot: Parameters<typeof lineage.computeSnapshotHash>[0]): Promise<string> {
    return lineage.computeSnapshotHash(snapshot);
  }

  async computeWorldId(
    schemaHash: string,
    snapshotHash: string,
    parentWorldId: string | null
  ): Promise<string> {
    return lineage.computeWorldId(schemaHash, snapshotHash, parentWorldId);
  }

  createMemoryStore() {
    return lineage.createInMemoryLineageStore();
  }

  createService(store: ReturnType<typeof lineage.createInMemoryLineageStore>) {
    return lineage.createLineageService(store);
  }

  exports(): Record<string, unknown> {
    return lineage;
  }
}

export function createLineageComplianceAdapter(): LineageComplianceAdapter {
  return new SplitNativeLineageComplianceAdapter();
}
