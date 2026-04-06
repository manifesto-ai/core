import type { ManifestoDomainShape } from "@manifesto-ai/sdk";

import { freezeValue, markCoreEnumerator } from "./internal.js";
import type { ActionCandidate, ActionEnumerator } from "./runtime-types.js";

export function createCoreEnumerator<T extends ManifestoDomainShape>(): ActionEnumerator<T> {
  const enumerator = {
    enumerate() {
      return Object.freeze([]) as readonly ActionCandidate<T>[];
    },
  } as ActionEnumerator<T>;

  return freezeValue(markCoreEnumerator(enumerator));
}
