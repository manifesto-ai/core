import { describe, expectTypeOf, it } from "vitest";

import type {
  GovernanceRuntimeKernel,
  LineageRuntimeKernel,
  RuntimeKernel,
  WaitForProposalRuntimeKernel,
} from "../runtime/kernel-contract.js";
import type { ManifestoDomainShape } from "../types.js";

type Domain = {
  actions: { ping: () => void };
  state: { count: number };
  computed: {};
};

/**
 * Seam-focused type coverage (#421): decorator and tooling code depends on
 * the narrow kernel aliases, so a test double must be satisfiable WITHOUT
 * implementing the full compatibility RuntimeKernel aggregate.
 */
describe("kernel contract seams (#421)", () => {
  it("WaitForProposalRuntimeKernel needs only disposal + outcome derivation", () => {
    type Minimal = WaitForProposalRuntimeKernel<Domain>;
    type FullKernel = RuntimeKernel<Domain>;

    // The seam is a strict subset of the full kernel…
    expectTypeOf<FullKernel>().toExtend<Minimal>();
    // …and a much smaller one: a double only carries the picked members.
    type MinimalKeys = keyof Minimal;
    expectTypeOf<MinimalKeys>().not.toEqualTypeOf<keyof FullKernel>();
  });

  it("decorator kernels are facet compositions, strictly narrower than the aggregate", () => {
    expectTypeOf<RuntimeKernel<Domain>>().toExtend<LineageRuntimeKernel<Domain>>();
    expectTypeOf<RuntimeKernel<Domain>>().toExtend<GovernanceRuntimeKernel<Domain>>();
    expectTypeOf<
      keyof LineageRuntimeKernel<Domain>
    >().not.toEqualTypeOf<keyof RuntimeKernel<Domain>>();
  });

  it("provider seam re-exports stay source-compatible with the contract module", async () => {
    const provider = await import("../provider.js");
    const compat = await import("../compat/internal.js");
    // Attachment helpers and factories remain on the compat layer.
    expectTypeOf(compat.attachRuntimeKernelFactory).toBeFunction();
    expectTypeOf(compat.createRuntimeKernel).toBeFunction();
    expectTypeOf(provider.createRuntimeKernel).toBeFunction();
  });
});
