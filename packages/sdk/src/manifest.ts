/**
 * SDK package identity and SPEC version metadata.
 * Used for phase tracking and compatibility verification.
 */
export type SdkManifest = {
  readonly name: '@manifesto-ai/sdk';
  readonly specVersion: '0.1.0';
  readonly phase: 'bootstrap';
};
