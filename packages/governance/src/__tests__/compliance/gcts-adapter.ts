import * as governance from "../../index.js";
import type { GovernanceComplianceAdapter } from "./gcts-types.js";

export class LegacyWorldBackedGovernanceComplianceAdapter implements GovernanceComplianceAdapter {
  isValidTransition(from: Parameters<typeof governance.isValidTransition>[0], to: Parameters<typeof governance.isValidTransition>[1]): boolean {
    return governance.isValidTransition(from, to);
  }

  getValidTransitions(status: Parameters<typeof governance.getValidTransitions>[0]) {
    return governance.getValidTransitions(status);
  }

  exports(): Record<string, unknown> {
    return governance;
  }
}

export function createGovernanceComplianceAdapter(): GovernanceComplianceAdapter {
  return new LegacyWorldBackedGovernanceComplianceAdapter();
}
