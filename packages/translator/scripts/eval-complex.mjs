/**
 * Complex LLM Integration Evaluation
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { translate, createOpenAIProvider } from "../dist/index.js";

// Load .env.local
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  }
} catch (e) {}

const provider = createOpenAIProvider();

// Test cases with expected behavior
const testCases = [
  {
    name: "복잡한 프로젝트 설정",
    input: "Create a new project called 'Website Redesign', add 5 tasks for design phase, assign them to the design team, and set the deadline to next Friday",
    expectedNodes: 4,
    expectedClasses: ["CREATE", "CREATE", "TRANSFORM", "TRANSFORM"],
  },
  {
    name: "조건부 작업",
    input: "Find all overdue tasks, mark them as high priority, and send a notification to their assignees",
    expectedNodes: 3,
    expectedClasses: ["OBSERVE", "TRANSFORM", "CONTROL"],
  },
  {
    name: "데이터 분석 요청",
    input: "Calculate the average completion time for all tasks in Q4, compare it with Q3, and generate a report",
    expectedNodes: 3,
    expectedClasses: ["SOLVE", "SOLVE", "CREATE"],
  },
  {
    name: "사용자 관리",
    input: "Create a new team called 'Backend', add John, Sarah, and Mike to the team, and give them access to the API project",
    expectedNodes: 3,
    expectedClasses: ["CREATE", "TRANSFORM", "TRANSFORM"],
  },
  {
    name: "복잡한 필터링",
    input: "Show me all tasks that are either high priority or overdue, excluding those assigned to the intern team",
    expectedNodes: 1,
    expectedClasses: ["OBSERVE"],
  },
  {
    name: "워크플로우 자동화",
    input: "When a task is marked as complete, automatically move it to the archive, update the project progress, and notify the project manager",
    expectedNodes: 3,
    expectedClasses: ["CONTROL", "TRANSFORM", "CONTROL"],
  },
  {
    name: "한국어 복잡한 요청",
    input: "새 프로젝트 '모바일 앱 개발'을 만들고, 기획 단계 태스크 3개를 추가한 다음, 개발팀에 할당하고 다음 주 월요일까지 완료하도록 설정해줘",
    expectedNodes: 4,
    expectedClasses: ["CREATE", "CREATE", "TRANSFORM", "TRANSFORM"],
  },
  {
    name: "모호한 요청",
    input: "Fix that thing we discussed yesterday and make it better",
    expectedNodes: 1,
    expectedAmbiguous: true,
  },
  {
    name: "다단계 의존성",
    input: "First create a database schema, then generate the API endpoints based on it, after that create the frontend components, and finally write integration tests for everything",
    expectedNodes: 4,
    expectedChainedDeps: true,
  },
  {
    name: "삭제 및 복구",
    input: "Delete all completed tasks from last month but first backup them to the archive, then send a summary report to the admin",
    expectedNodes: 3,
    expectedClasses: ["CONTROL", "CONTROL", "CONTROL"],
  },
];

async function runTest(testCase) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 ${testCase.name}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Input: "${testCase.input}"\n`);

  const startTime = Date.now();

  try {
    const result = await translate(testCase.input, {
      llm: { provider },
      language: testCase.input.match(/[가-힣]/) ? "ko" : "en",
    });

    const elapsed = Date.now() - startTime;

    console.log(`⏱️  Time: ${elapsed}ms`);
    console.log(`📊 Nodes: ${result.graph.nodes.length} (expected: ${testCase.expectedNodes || "N/A"})`);

    // Print each node
    for (const node of result.graph.nodes) {
      const deps = node.dependsOn.length > 0 ? ` → depends on [${node.dependsOn.join(", ")}]` : "";
      const status = node.resolution.status;
      const score = node.resolution.ambiguityScore.toFixed(3);

      console.log(`\n  [${node.id}] ${node.ir.event.lemma} (${node.ir.event.class})${deps}`);
      console.log(`      Status: ${status}, Ambiguity: ${score}`);

      // Print args
      const args = Object.entries(node.ir.args);
      if (args.length > 0) {
        for (const [role, term] of args) {
          let termStr = "";
          if (term.kind === "entity") {
            termStr = `entity:${term.entityType}`;
            if (term.ref) termStr += ` (ref: ${term.ref.kind})`;
          } else if (term.kind === "value") {
            termStr = `value:${term.valueType}=${JSON.stringify(term.raw)}`;
          } else {
            termStr = `${term.kind}`;
          }
          console.log(`      ${role}: ${termStr}`);
        }
      }
    }

    // Evaluation
    console.log(`\n📈 Evaluation:`);

    const nodeCountMatch = !testCase.expectedNodes || result.graph.nodes.length >= testCase.expectedNodes;
    console.log(`  - Node count: ${nodeCountMatch ? "✅" : "❌"} (${result.graph.nodes.length}/${testCase.expectedNodes || "N/A"})`);

    if (testCase.expectedChainedDeps) {
      const hasChain = result.graph.nodes.some((n, i) =>
        i > 0 && n.dependsOn.length > 0
      );
      console.log(`  - Dependency chain: ${hasChain ? "✅" : "❌"}`);
    }

    if (testCase.expectedAmbiguous) {
      const isAmbiguous = result.graph.nodes.some(n =>
        n.resolution.status === "Ambiguous" || n.resolution.ambiguityScore > 0.3
      );
      console.log(`  - Ambiguity detected: ${isAmbiguous ? "✅" : "❌"}`);
    }

    if (result.warnings.length > 0) {
      console.log(`  - Warnings: ${result.warnings.map(w => w.code).join(", ")}`);
    }

    // Success requires meeting expected node count
    const success = nodeCountMatch;
    if (!success) {
      console.log(`\n  ❌ FAILED: Expected ${testCase.expectedNodes} nodes, got ${result.graph.nodes.length}`);
    }

    return {
      success,
      elapsed,
      nodes: result.graph.nodes.length,
      expectedNodes: testCase.expectedNodes,
      graph: result.graph,
      warnings: result.warnings,
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`❌ Error (${elapsed}ms): ${error.message}`);
    return {
      success: false,
      elapsed,
      error: error.message,
      expectedNodes: testCase.expectedNodes,
    };
  }
}

async function main() {
  console.log("🚀 Complex LLM Integration Evaluation");
  console.log(`Running ${testCases.length} test cases...\n`);

  const results = [];
  const jsonResults = [];
  let totalTime = 0;

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.push({ name: testCase.name, ...result });
    totalTime += result.elapsed;

    // Collect detailed JSON result
    jsonResults.push({
      name: testCase.name,
      input: testCase.input,
      expectedNodes: testCase.expectedNodes,
      expectedClasses: testCase.expectedClasses,
      expectedAmbiguous: testCase.expectedAmbiguous,
      expectedChainedDeps: testCase.expectedChainedDeps,
      result: {
        success: result.success,
        elapsed: result.elapsed,
        nodeCount: result.nodes,
        graph: result.graph || null,
        warnings: result.warnings || [],
        error: result.error || null,
      },
    });
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 SUMMARY");
  console.log(`${"=".repeat(60)}`);

  const passed = results.filter(r => r.success).length;
  console.log(`\nResults: ${passed}/${results.length} passed`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Average time: ${(totalTime / results.length / 1000).toFixed(2)}s per request`);

  console.log("\n| Test | Status | Time | Nodes | Expected |");
  console.log("|------|--------|------|-------|----------|");
  for (const r of results) {
    const status = r.success ? "✅" : "❌";
    const time = `${(r.elapsed / 1000).toFixed(2)}s`;
    const nodes = r.nodes ?? "-";
    const expected = r.expectedNodes ?? "-";
    console.log(`| ${r.name} | ${status} | ${time} | ${nodes} | ${expected} |`);
  }

  // Detailed failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log(`\n${"─".repeat(60)}`);
    console.log("❌ Failed Tests:");
    for (const f of failures) {
      const reason = f.error || `Expected ${f.expectedNodes} nodes, got ${f.nodes}`;
      console.log(`  - ${f.name}: ${reason}`);
    }
  }

  // Save JSON results
  const timestamp = new Date().toISOString().split("T")[0];
  const outputDir = resolve(process.cwd(), "eval-results");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (e) {}

  const jsonPath = resolve(outputDir, `complex-eval-${timestamp}.json`);
  const jsonOutput = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
      totalTime,
      avgTimePerTest: totalTime / results.length,
    },
    tests: jsonResults,
  };

  writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`\n📁 JSON results saved to: ${jsonPath}`);
}

main().catch(console.error);
