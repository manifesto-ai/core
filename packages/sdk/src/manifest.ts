/**
 * SDK package identity and SPEC version metadata.
 * Used for phase tracking and compatibility verification.
 */
export type SdkManifest = {
  readonly name: '@manifesto-ai/sdk';
  readonly specVersion: '2.0.0';
  readonly phase: 'released';
};
