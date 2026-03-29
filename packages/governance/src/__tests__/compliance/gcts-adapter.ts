import * as governance from "../../index.js";
import type { GovernanceComplianceAdapter } from "./gcts-types.js";

export class NativeGovernanceComplianceAdapter
  implements GovernanceComplianceAdapter
{
  isValidTransition(
    from: Parameters<typeof governance.isValidTransition>[0],
    to: Parameters<typeof governance.isValidTransition>[1]
  ): boolean {
    return governance.isValidTransition(from, to);
  }

  getValidTransitions(
    status: Parameters<typeof governance.getValidTransitions>[0]
  ) {
    return governance.getValidTransitions(status);
  }

  createStore() {
    return governance.createInMemoryGovernanceStore();
  }

  createService(
    store: ReturnType<typeof governance.createInMemoryGovernanceStore>,
    options?: ConstructorParameters<typeof governance.DefaultGovernanceService>[1]
  ) {
    return governance.createGovernanceService(store, options);
  }

  exports(): Record<string, unknown> {
    return governance;
  }
}

export function createGovernanceComplianceAdapter(): GovernanceComplianceAdapter {
  return new NativeGovernanceComplianceAdapter();
}
