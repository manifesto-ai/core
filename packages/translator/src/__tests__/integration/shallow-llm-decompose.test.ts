/**
 * @fileoverview Integration Tests for ShallowLLMDecompose
 *
 * These tests make REAL API calls to OpenAI.
 * Requires OPENAI_API_KEY in .env.local or environment.
 *
 * Run with: pnpm test:integration
 *
 * Per ADR-003 v0.11:
 * - C-DEC-1: Each chunk.text MUST be a contiguous substring of input
 * - C-DEC-5: LLM strategies MUST include span and verify
 * - C-LLM-DEC-1/2: Fallback on verification failure
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ShallowLLMDecompose } from "../../index.js";

// =============================================================================
// Setup
// =============================================================================

// Load .env.local if exists
function loadEnvLocal(): void {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // .env.local not found, skip
  }
}

loadEnvLocal();

const API_KEY = process.env.OPENAI_API_KEY;
const SKIP_REASON = "OPENAI_API_KEY not set - skipping integration tests";

// =============================================================================
// Tests
// =============================================================================

describe.skipIf(!API_KEY)("ShallowLLMDecompose Integration", () => {
  let strategy: ShallowLLMDecompose;

  beforeAll(() => {
    strategy = new ShallowLLMDecompose({
      apiKey: API_KEY,
      model: "gpt-4o-mini",
      temperature: 0.1,
    });
  });

  it(
    "decomposes multi-intent sentence into segments",
    async () => {
      const text = "Create a new project and add three tasks to it";
      const result = await strategy.decompose(text);

      console.log("Input:", text);
      console.log("Segments:", result.chunks.map((c) => c.text));

      expect(result.chunks.length).toBeGreaterThanOrEqual(2);
      expect(strategy.name).toBe("shallow-llm");

      // ADR-003 C-DEC-1: Verify substring constraint
      for (const chunk of result.chunks) {
        expect(text).toContain(chunk.text);
        // ADR-003 C-DEC-5: Verify span
        if (chunk.span) {
          const extracted = text.slice(chunk.span[0], chunk.span[1]);
          expect(extracted.trim()).toBe(chunk.text);
        }
      }
    },
    30000
  );

  it(
    "decomposes complex multi-action text",
    async () => {
      const text =
        "Delete the old files, then compress the remaining ones and upload them to the server";
      const result = await strategy.decompose(text);

      console.log("Input:", text);
      console.log("Segments:", result.chunks.map((c) => c.text));

      expect(result.chunks.length).toBeGreaterThanOrEqual(3);

      // Verify substring constraint
      for (const chunk of result.chunks) {
        expect(text).toContain(chunk.text);
      }
    },
    30000
  );

  it(
    "keeps single intent as single chunk",
    async () => {
      const text = "Create a new project";
      const result = await strategy.decompose(text);

      console.log("Input:", text);
      console.log("Segments:", result.chunks.map((c) => c.text));

      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0].text).toBe(text);
    },
    30000
  );

  it(
    "handles Korean text",
    async () => {
      const text = "새 프로젝트를 만들고 거기에 작업 3개를 추가해줘";
      const result = await strategy.decompose(text);

      console.log("Input:", text);
      console.log("Segments:", result.chunks.map((c) => c.text));

      expect(result.chunks.length).toBeGreaterThanOrEqual(1);
      expect(strategy.name).toBe("shallow-llm");

      // Verify substring constraint
      for (const chunk of result.chunks) {
        expect(text).toContain(chunk.text);
      }
    },
    30000
  );

  it(
    "handles mixed sequential actions with 'then'",
    async () => {
      const text =
        "First create the database, then add the tables, and finally populate with sample data";
      const result = await strategy.decompose(text);

      console.log("Input:", text);
      console.log("Segments:", result.chunks.map((c) => c.text));

      expect(result.chunks.length).toBeGreaterThanOrEqual(3);
    },
    30000
  );

  it(
    "handles complex multi-intent text with 10+ actions",
    async () => {
      const text = `
        Create a new e-commerce project, set up the database schema,
        add user authentication module, implement product catalog,
        create shopping cart functionality, set up payment gateway integration,
        add order management system, implement inventory tracking,
        create admin dashboard, set up email notifications,
        add analytics tracking, and finally deploy to production server
      `.trim();

      const result = await strategy.decompose(text);

      console.log("=== Complex Multi-Intent Test (10+ actions) ===");
      console.log("Input:", text);
      console.log("\nSegments found:", result.chunks.length);
      result.chunks.forEach((chunk, i) => {
        console.log(`  ${i + 1}. [${chunk.id}] ${chunk.text}`);
        if (chunk.span) {
          console.log(`      span: [${chunk.span[0]}, ${chunk.span[1]}]`);
        }
      });

      expect(result.chunks.length).toBeGreaterThanOrEqual(10);
      expect(strategy.name).toBe("shallow-llm");
    },
    60000
  );

  it(
    "handles complex Korean multi-intent text with 10+ actions",
    async () => {
      const text = `
        새 프로젝트를 생성하고, 데이터베이스를 설정하고,
        사용자 인증 모듈을 추가하고, 상품 카탈로그를 구현하고,
        장바구니 기능을 만들고, 결제 시스템을 연동하고,
        주문 관리 시스템을 추가하고, 재고 추적 기능을 구현하고,
        관리자 대시보드를 만들고, 이메일 알림을 설정하고,
        분석 추적 기능을 추가하고, 마지막으로 프로덕션 서버에 배포해줘
      `.trim();

      const result = await strategy.decompose(text);

      console.log("=== Complex Korean Multi-Intent Test (10+ actions) ===");
      console.log("Input:", text);
      console.log("\nSegments found:", result.chunks.length);
      result.chunks.forEach((chunk, i) => {
        console.log(`  ${i + 1}. [${chunk.id}] ${chunk.text}`);
        if (chunk.span) {
          console.log(`      span: [${chunk.span[0]}, ${chunk.span[1]}]`);
        }
      });

      expect(result.chunks.length).toBeGreaterThanOrEqual(10);
      expect(strategy.name).toBe("shallow-llm");
    },
    60000
  );

  // ADR-003 C-DEC-5: Span verification test
  it(
    "C-DEC-5: all chunks have valid spans matching substring",
    async () => {
      const text =
        "Create a project, add users, configure settings, and deploy to production";
      const result = await strategy.decompose(text);

      for (const chunk of result.chunks) {
        expect(chunk.id).toBeDefined();
        expect(chunk.text).toBeDefined();
        expect(chunk.span).toBeDefined();

        // Verify span correctness
        if (chunk.span) {
          const extracted = text.slice(chunk.span[0], chunk.span[1]);
          // The extracted text should contain the chunk text
          // (may have leading/trailing whitespace)
          expect(extracted.trim()).toBe(chunk.text);
        }
      }
    },
    30000
  );
});

// Log skip reason if API key not available
describe("ShallowLLMDecompose Setup", () => {
  it("reports API key status", () => {
    if (!API_KEY) {
      console.log(SKIP_REASON);
    } else {
      console.log("OPENAI_API_KEY is set - running integration tests");
    }
    expect(true).toBe(true);
  });
});
