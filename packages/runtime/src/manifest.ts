/**
 * Runtime package identity and SPEC version metadata.
 * Used for phase tracking and compatibility verification.
 */
export type RuntimeManifest = {
  readonly name: '@manifesto-ai/runtime';
  readonly specVersion: '0.1.0';
  readonly phase: 'bootstrap';
};
