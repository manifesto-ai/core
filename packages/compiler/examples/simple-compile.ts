/**
 * Simple compiler example
 *
 * Usage:
 *   pnpm --filter @manifesto-ai/compiler example
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createCompiler } from "../src/index.js";

// Load .env.local from workspaces/core root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env.local") });

async function main() {
  console.log("🚀 Creating compiler with OpenAI...\n");

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not found in environment");
    console.log("Checked path:", resolve(__dirname, "../../../.env.local"));
    process.exit(1);
  }

  console.log("✓ API key found\n");

  // Debug: Check domain schema
  const { CompilerDomain } = await import("../src/index.js");
  console.log("Start action available expr:", JSON.stringify(CompilerDomain.schema.actions.start.available, null, 2));
  console.log("Computed fields:", Object.keys(CompilerDomain.schema.computed.fields));

  // Check initial state
  const compiler = createCompiler({
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
    },
    maxRetries: 3,
  });

  // Start compilation
  const input = `
    사용자 이름과 이메일을 저장한다.
    사용자가 프로필을 업데이트할 수 있다.
    총 사용자 수를 계산한다.
  `;

  console.log("📝 Input:", input.trim());
  console.log("\n⏳ Compiling...\n");

  try {
    // Check initial state - check raw host snapshot
    const { ManifestoCompiler } = await import("../src/api/compiler.js");
    // @ts-ignore - access private property for debugging
    const hostSnapshot = await (compiler as any).host.getSnapshot();
    console.log("Host snapshot computed:", hostSnapshot?.computed);

    const initial = await compiler.getSnapshot();
    console.log("Initial state:", { status: initial.status, isIdle: initial.isIdle });

    await compiler.start({ text: input });

    const snapshot = await compiler.getSnapshot();
    console.log("📊 Final status:", snapshot.status);

    if (snapshot.status === "success" && snapshot.result) {
      console.log("\n✅ Compilation successful!");
      console.log("Result:", JSON.stringify(snapshot.result, null, 2));
    } else if (snapshot.status === "discarded") {
      console.log("\n❌ Compilation discarded:", snapshot.discardReason);
      console.log("Diagnostics:", JSON.stringify(snapshot.diagnostics, null, 2));
    } else {
      console.log("\n⚠️ Unexpected state:", snapshot.status);
      console.log("Segments:", snapshot.segments);
      console.log("Intents:", snapshot.intents);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
  }

  console.log("\n🏁 Done!");
}

main().catch(console.error);
