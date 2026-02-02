import { toCanonical } from "./canonical.js";
import type { DomainSchema } from "../schema/domain.js";

export type SchemaHashMode = "semantic" | "effective";

export type SchemaHashInput = {
  id: string;
  version: string;
  types: Record<string, unknown>;
  state: { fields: Record<string, unknown> };
  computed: {
    fields: Record<string, { deps: string[]; expr: unknown; description?: string }>;
  };
  actions: Record<string, unknown>;
  meta?: {
    name?: string;
    description?: string;
    authors?: string[];
  };
};

function normalizeSchemaForHash(
  schema: SchemaHashInput,
  mode: SchemaHashMode
): SchemaHashInput {
  if (mode === "effective") {
    return schema;
  }

  const fields = schema.state?.fields ?? {};
  const filteredEntries = Object.entries(fields).filter(([key]) => !key.startsWith("$"));
  if (filteredEntries.length === Object.keys(fields).length) {
    return schema;
  }

  return {
    ...schema,
    state: {
      ...schema.state,
      fields: Object.fromEntries(filteredEntries),
    },
  };
}

/**
 * SHA-256 hash using Web Crypto API
 * Works in both browser and Node.js
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);

  // Use Web Crypto API
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const SHA256_INIT = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

function sha256RotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

function sha256Bytes(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const withOne = data.length + 1;
  const padLen = withOne % 64 <= 56 ? 56 - (withOne % 64) : 120 - (withOne % 64);
  const totalLen = withOne + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(data);
  padded[data.length] = 0x80;

  const bitLenHi = Math.floor(bitLen / 0x100000000);
  const bitLenLo = bitLen >>> 0;
  padded[totalLen - 8] = (bitLenHi >>> 24) & 0xff;
  padded[totalLen - 7] = (bitLenHi >>> 16) & 0xff;
  padded[totalLen - 6] = (bitLenHi >>> 8) & 0xff;
  padded[totalLen - 5] = bitLenHi & 0xff;
  padded[totalLen - 4] = (bitLenLo >>> 24) & 0xff;
  padded[totalLen - 3] = (bitLenLo >>> 16) & 0xff;
  padded[totalLen - 2] = (bitLenLo >>> 8) & 0xff;
  padded[totalLen - 1] = bitLenLo & 0xff;

  const h = new Uint32Array(SHA256_INIT);
  const view = new DataView(padded.buffer);

  for (let offset = 0; offset < padded.length; offset += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = sha256RotateRight(w[i - 15], 7) ^ sha256RotateRight(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = sha256RotateRight(w[i - 2], 17) ^ sha256RotateRight(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let i = 0; i < 64; i++) {
      const s1 = sha256RotateRight(e, 6) ^ sha256RotateRight(e, 11) ^ sha256RotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = sha256RotateRight(a, 2) ^ sha256RotateRight(a, 13) ^ sha256RotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < h.length; i++) {
    outView.setUint32(i * 4, h[i]);
  }
  return out;
}

/**
 * SHA-256 hash using a synchronous pure JS implementation
 */
export function sha256Sync(message: string): string {
  const data = new TextEncoder().encode(message);
  const hash = sha256Bytes(data);
  let hex = "";
  for (const byte of hash) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Hash a schema in canonical form
 */
export async function hashSchema(
  schema: SchemaHashInput,
  mode: SchemaHashMode = "semantic"
): Promise<string> {
  // Create canonical form without the hash field
  const canonical = toCanonical(normalizeSchemaForHash(schema, mode));
  return sha256(canonical);
}

/**
 * Hash a schema in canonical form (sync)
 */
export function hashSchemaSync(
  schema: SchemaHashInput,
  mode: SchemaHashMode = "semantic"
): string {
  const canonical = toCanonical(normalizeSchemaForHash(schema, mode));
  return sha256Sync(canonical);
}

export async function hashSchemaEffective(
  schema: SchemaHashInput
): Promise<string> {
  return hashSchema(schema, "effective");
}

export function hashSchemaEffectiveSync(
  schema: SchemaHashInput
): string {
  return hashSchemaSync(schema, "effective");
}

/**
 * Generate deterministic requirement ID
 * Based on: schemaHash, intentId, actionId, flowNodePath
 */
export async function generateRequirementId(
  schemaHash: string,
  intentId: string,
  actionId: string,
  flowNodePath: string
): Promise<string> {
  const input = `${schemaHash}:${intentId}:${actionId}:${flowNodePath}`;
  const hash = await sha256(input);
  // Return first 16 characters for brevity
  return `req-${hash.slice(0, 16)}`;
}

/**
 * Generate deterministic requirement ID (sync)
 */
export function generateRequirementIdSync(
  schemaHash: string,
  intentId: string,
  actionId: string,
  flowNodePath: string
): string {
  const input = `${schemaHash}:${intentId}:${actionId}:${flowNodePath}`;
  const hash = sha256Sync(input);
  return `req-${hash.slice(0, 16)}`;
}

/**
 * Generate a trace node ID
 */
export function generateTraceId(index: number = 0): string {
  return `trace-${index}`;
}
