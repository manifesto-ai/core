import { describe, it } from "vitest";

describe("SDK v5 action-candidate contract", () => {
  it.todo("exposes only the v5 root surface: snapshot, actions, action, observe, inspect, and dispose");

  it.todo("keeps v3 root verbs absent from the canonical v5 runtime root");

  it.todo("exposes action handles with info, available, check, preview, submit, and bind");

  it.todo("checks admission in first-failing-layer order: availability, input, dispatchability");

  it.todo("keeps preview pure, non-committing, non-publishing, and non-enqueuing");

  it.todo("returns base submit results with mode base, protocol ok, status settled, before, after, and outcome");

  it.todo("keeps full projected before and after snapshots in settled submit results regardless of payload size");

  it.todo("keeps action-name collisions accessible through action(name) without corrupting runtime members");

  it.todo("packs BoundAction.intent() inputs from activated action metadata, not runtime argument introspection");

  it.todo("recognizes PreviewOptions and SubmitOptions only as extra final discriminated arguments");

  it.todo("rejects operational submit failure before terminal result with SubmissionFailedError");

  it.todo("emits submission:failed for operational submit failure before terminal result");

  it.todo("emits observe.event payloads matching ManifestoEventPayloadMap without full snapshots");
});
