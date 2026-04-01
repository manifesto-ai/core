import * as lineage from "../../index.js";
import { computeSnapshotHash, computeWorldId } from "../../hash.js";
import { createLineageService } from "../../service/lineage-service.js";
import type { LineageComplianceAdapter } from "./lcts-types.js";

export class SplitNativeLineageComplianceAdapter implements LineageComplianceAdapter {
  async computeSnapshotHash(snapshot: Parameters<typeof computeSnapshotHash>[0]): Promise<string> {
    return computeSnapshotHash(snapshot);
  }

  async computeWorldId(
    schemaHash: string,
    snapshotHash: string,
    parentWorldId: string | null
  ): Promise<string> {
    return computeWorldId(schemaHash, snapshotHash, parentWorldId);
  }

  createMemoryStore() {
    return lineage.createInMemoryLineageStore();
  }

  createService(store: ReturnType<typeof lineage.createInMemoryLineageStore>) {
    return createLineageService(store);
  }

  exports(): Record<string, unknown> {
    return lineage;
  }
}

export function createLineageComplianceAdapter(): LineageComplianceAdapter {
  return new SplitNativeLineageComplianceAdapter();
}
