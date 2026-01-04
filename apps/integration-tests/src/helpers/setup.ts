/**
 * Test Setup
 *
 * Global setup for vitest.
 */

import { afterEach, afterAll, vi } from "vitest";

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Clean up any pending timers
afterAll(() => {
  vi.useRealTimers();
});

// Log environment info on first load
console.log("\n=== Integration Test Environment ===");
console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? "Available" : "Not Set"}`);
console.log(`Anthropic API Key: ${process.env.ANTHROPIC_API_KEY ? "Available" : "Not Set"}`);
console.log("====================================\n");
