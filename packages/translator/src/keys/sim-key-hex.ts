/**
 * @fileoverview SimKey Serialization Utilities
 *
 * SimKey is a 64-bit bigint internally, serialized as 16-char lowercase hex for storage/transport.
 * Aligned with SPEC §6.2-6.4.
 */

import type { SimKeyHex } from "../types/index.js";

/**
 * SimKey internal type (64-bit bigint)
 */
export type SimKey = bigint;

/**
 * Serialize SimKey (bigint) to SimKeyHex (16-char lowercase hex, zero-padded)
 * SPEC §6.2 TAPP-KEY-3
 *
 * @example
 * serializeSimKey(0n) // "0000000000000000"
 * serializeSimKey(255n) // "00000000000000ff"
 * serializeSimKey(0xdeadbeefcafebabenbn) // "deadbeefcafebabe"
 */
export function serializeSimKey(simKey: SimKey): SimKeyHex {
  return simKey.toString(16).padStart(16, "0");
}

/**
 * Deserialize SimKeyHex (16-char lowercase hex) to SimKey (bigint)
 * SPEC §6.2 TAPP-KEY-3
 *
 * @example
 * deserializeSimKey("0000000000000000") // 0n
 * deserializeSimKey("00000000000000ff") // 255n
 * deserializeSimKey("deadbeefcafebabe") // 0xdeadbeefcafebabenbn
 */
export function deserializeSimKey(hex: SimKeyHex): SimKey {
  return BigInt("0x" + hex);
}

/**
 * Validate SimKeyHex format
 * Must be exactly 16 lowercase hex characters
 */
export function isValidSimKeyHex(hex: string): hex is SimKeyHex {
  return /^[0-9a-f]{16}$/.test(hex);
}

/**
 * Zero SimKey constant
 */
export const ZERO_SIM_KEY: SimKey = 0n;

/**
 * Zero SimKeyHex constant
 */
export const ZERO_SIM_KEY_HEX: SimKeyHex = "0000000000000000";
