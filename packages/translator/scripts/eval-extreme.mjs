/**
 * Extreme Heavy Input Evaluation
 *
 * Tests translator with real-world heavy inputs:
 * - Full PRD documents
 * - Technical specifications
 * - Long requirement lists
 * - Multi-paragraph instructions
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

// =============================================================================
// Extreme Test Cases
// =============================================================================

const extremeTestCases = [
  {
    name: "Mini PRD - 사용자 인증 시스템",
    input: `
# 사용자 인증 시스템 PRD

## 개요
사용자 인증 및 권한 관리 시스템을 구축합니다.

## 요구사항

### 1. 회원가입
- 이메일 기반 회원가입 구현
- 비밀번호 유효성 검사 (최소 8자, 특수문자 포함)
- 이메일 인증 발송
- 중복 이메일 체크

### 2. 로그인
- JWT 기반 인증
- Remember me 기능
- 로그인 실패 횟수 제한 (5회)
- 2FA 지원 (선택)

### 3. 비밀번호 관리
- 비밀번호 재설정 이메일 발송
- 비밀번호 변경 기능
- 이전 비밀번호 재사용 금지

이 PRD를 기반으로 필요한 모든 태스크를 생성해주세요.
`,
    expectedMinNodes: 5,
    description: "PRD에서 태스크 추출",
  },

  {
    name: "Technical Spec - API 엔드포인트",
    input: `
Create the following REST API endpoints for a task management system:

1. GET /api/tasks - List all tasks with pagination (page, limit params)
2. POST /api/tasks - Create a new task with title, description, priority, dueDate
3. GET /api/tasks/:id - Get single task by ID
4. PUT /api/tasks/:id - Update task (partial update supported)
5. DELETE /api/tasks/:id - Soft delete task
6. POST /api/tasks/:id/complete - Mark task as completed
7. GET /api/tasks/stats - Get task statistics (total, completed, pending, overdue)

Each endpoint should:
- Validate input using Zod schemas
- Return proper HTTP status codes
- Include error handling middleware
- Log all requests

Generate the implementation tasks for each endpoint.
`,
    expectedMinNodes: 7,
    description: "API 스펙에서 구현 태스크 생성",
  },

  {
    name: "Sprint Planning - 2주 스프린트",
    input: `
Sprint 23 Planning - E-commerce Checkout Revamp

Week 1:
- Design new checkout flow wireframes
- Create UI components for cart summary
- Implement address autocomplete using Google Places API
- Add payment method selection (Credit Card, PayPal, Apple Pay)
- Write unit tests for cart calculations

Week 2:
- Integrate Stripe payment processing
- Add order confirmation email templates
- Implement order tracking page
- Set up error monitoring with Sentry
- Conduct QA testing and bug fixes
- Deploy to staging environment
- Get stakeholder approval
- Deploy to production

Assign Week 1 tasks to the frontend team and Week 2 tasks to the fullstack team.
Set all deadlines accordingly.
`,
    expectedMinNodes: 10,
    description: "스프린트 계획에서 태스크 생성",
  },

  {
    name: "Bug Report Batch - 다중 버그 수정",
    input: `
Critical bugs to fix before release:

BUG-001: Login button not responding on Safari mobile
- Reproduce: Open login page on Safari iOS, tap login
- Expected: Form submits
- Actual: Nothing happens
- Priority: Critical

BUG-002: Cart total shows NaN when discount applied
- Reproduce: Add item, apply 50% coupon
- Expected: Shows discounted price
- Actual: Shows "NaN"
- Priority: High

BUG-003: Email notifications sent twice
- Reproduce: Complete order
- Expected: 1 confirmation email
- Actual: 2 identical emails
- Priority: Medium

BUG-004: Dark mode toggle doesn't persist
- Reproduce: Enable dark mode, refresh page
- Expected: Dark mode remains
- Actual: Reverts to light mode
- Priority: Low

BUG-005: Search results pagination broken after filter
- Reproduce: Search "shoes", filter by "red", go to page 2
- Expected: Shows page 2 of red shoes
- Actual: Shows page 2 of all shoes (filter reset)
- Priority: High

Create fix tasks for each bug, prioritized by severity.
`,
    expectedMinNodes: 5,
    description: "버그 리포트 배치에서 수정 태스크 생성",
  },

  {
    name: "Database Migration Plan",
    input: `
Database Migration Plan: PostgreSQL to MongoDB

Phase 1 - Preparation:
1. Audit current PostgreSQL schema (42 tables, 156 columns)
2. Design MongoDB document schemas
3. Create data mapping document
4. Set up MongoDB Atlas cluster
5. Configure connection pooling

Phase 2 - Migration Scripts:
1. Write extraction scripts for each table
2. Transform relational data to documents
3. Handle foreign key relationships with embedded documents or references
4. Migrate user data first (test batch of 1000 records)
5. Validate migrated data integrity

Phase 3 - Application Updates:
1. Update ORM from Prisma to Mongoose
2. Rewrite all database queries
3. Update transaction handling
4. Modify backup procedures

Phase 4 - Cutover:
1. Schedule maintenance window
2. Run final migration
3. Switch application database config
4. Verify all services operational
5. Monitor for 24 hours

Create tasks for all phases with proper dependencies.
`,
    expectedMinNodes: 15,
    description: "마이그레이션 계획에서 단계별 태스크 생성",
  },

  {
    name: "한국어 기능 명세서",
    input: `
# 알림 시스템 기능 명세서

## 1. 푸시 알림
### 1.1 기능 설명
사용자에게 실시간 푸시 알림을 전송하는 기능입니다.

### 1.2 구현 항목
- Firebase Cloud Messaging 연동
- 알림 토큰 관리 API 개발
- 알림 전송 큐 시스템 구축
- 알림 실패 재시도 로직 구현

## 2. 이메일 알림
### 2.1 기능 설명
중요 이벤트 발생 시 이메일로 알림을 전송합니다.

### 2.2 구현 항목
- SendGrid API 연동
- 이메일 템플릿 시스템 개발
- 구독 관리 기능 추가
- 스팸 방지 rate limiting 구현

## 3. 인앱 알림
### 3.1 기능 설명
앱 내부에서 알림 센터를 통해 알림을 표시합니다.

### 3.2 구현 항목
- 알림 센터 UI 컴포넌트 개발
- 읽음/안읽음 상태 관리
- 알림 필터링 기능
- 알림 일괄 삭제 기능

위 명세를 기반으로 개발 태스크를 생성하고, 각 섹션별로 의존성을 설정해주세요.
`,
    expectedMinNodes: 10,
    description: "기능 명세서에서 태스크 추출",
  },

  {
    name: "Microservices Architecture",
    input: `
Implement the following microservices architecture:

User Service:
- Handle user registration, authentication, profile management
- Tech stack: Node.js, Express, PostgreSQL
- Endpoints: /users, /auth/login, /auth/register, /auth/refresh

Product Service:
- Manage product catalog, inventory, pricing
- Tech stack: Go, Gin, MongoDB
- Endpoints: /products, /inventory, /categories

Order Service:
- Process orders, manage order lifecycle
- Tech stack: Java, Spring Boot, PostgreSQL
- Endpoints: /orders, /checkout, /payments

Notification Service:
- Send emails, push notifications, SMS
- Tech stack: Python, FastAPI, Redis
- Endpoints: /notify/email, /notify/push, /notify/sms

API Gateway:
- Route requests, handle authentication, rate limiting
- Tech stack: Kong or AWS API Gateway
- Configure routes for all services

Message Queue:
- Set up RabbitMQ for inter-service communication
- Define queues: order-created, payment-processed, notification-send

Create implementation tasks for each service and the infrastructure components.
`,
    expectedMinNodes: 12,
    description: "마이크로서비스 아키텍처에서 태스크 생성",
  },

  {
    name: "QA Test Plan",
    input: `
QA Test Plan for Mobile Banking App v2.0

Functional Testing:
1. Account Balance - Verify balance displays correctly after transactions
2. Fund Transfer - Test transfers between own accounts and to external accounts
3. Bill Payment - Test utility bill payments with scheduled and immediate options
4. Transaction History - Verify filtering by date, amount, type works correctly
5. Biometric Login - Test Face ID and Touch ID authentication

Performance Testing:
1. Load test login endpoint (target: 1000 concurrent users)
2. Stress test fund transfer (target: 500 transactions/minute)
3. API response time should be < 200ms for 95th percentile

Security Testing:
1. Penetration testing on all API endpoints
2. SQL injection testing on search fields
3. Session management validation
4. Certificate pinning verification

Create test execution tasks for each category.
`,
    expectedMinNodes: 8,
    description: "QA 테스트 플랜에서 실행 태스크 생성",
  },

  {
    name: "Onboarding Checklist - 신규 개발자",
    input: `
New Developer Onboarding Checklist

Day 1 - Setup:
□ Create company email account
□ Set up Slack and join channels (#engineering, #standup, #random)
□ Request GitHub organization access
□ Clone main repositories (frontend, backend, infrastructure)
□ Install development tools (VS Code, Docker, Node.js 18)
□ Configure local development environment
□ Run the application locally

Day 2 - Documentation:
□ Read engineering wiki
□ Review architecture documentation
□ Study API documentation
□ Understand deployment process

Day 3 - First Task:
□ Pick a "good first issue" from GitHub
□ Set up branch and make changes
□ Submit pull request
□ Address code review feedback
□ Merge to main branch

Assign mentor: Senior Developer
Set completion deadline: End of first week

Create onboarding tasks with proper sequence.
`,
    expectedMinNodes: 10,
    description: "온보딩 체크리스트에서 태스크 생성",
  },

  {
    name: "Chaos Engineering - Mega Input",
    input: `
${"Task ".repeat(50)}

위 내용을 파싱하고 적절한 Intent Graph를 생성해주세요.
동시에 다음 작업들도 수행해주세요:
1. 프로젝트 생성
2. 태스크 추가
3. 마감일 설정
4. 담당자 할당
5. 우선순위 설정

그리고 ${"이것은 매우 긴 문장입니다. ".repeat(30)}

마지막으로 모든 완료된 태스크를 아카이브하고 리포트를 생성해주세요.
`,
    expectedMinNodes: 3,
    description: "노이즈가 많은 입력에서 핵심 태스크 추출",
  },
];

// =============================================================================
// Runner
// =============================================================================

async function runExtremeTest(testCase, index) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📋 [${index + 1}/${extremeTestCases.length}] ${testCase.name}`);
  console.log(`📝 ${testCase.description}`);
  console.log(`${"=".repeat(70)}`);

  const inputLength = testCase.input.length;
  const inputLines = testCase.input.split("\n").length;
  console.log(`📊 Input: ${inputLength} chars, ${inputLines} lines`);
  console.log(`${"─".repeat(70)}`);

  const startTime = Date.now();

  try {
    const result = await translate(testCase.input, {
      llm: { provider },
      language: testCase.input.match(/[가-힣]/) ? "ko" : "en",
      maxNodes: 20, // Limit for extreme inputs
      // ADR-003: Use decomposition for complex inputs
      decompose: {
        strategy: "auto",
        autoThreshold: 200,
      },
    });

    const elapsed = Date.now() - startTime;

    console.log(`\n⏱️  Time: ${(elapsed / 1000).toFixed(2)}s`);
    console.log(`📊 Nodes: ${result.graph.nodes.length} (expected min: ${testCase.expectedMinNodes})`);

    // Print summary of nodes
    console.log(`\n${"─".repeat(70)}`);
    console.log("Generated Intent Nodes:");
    console.log(`${"─".repeat(70)}`);

    for (const node of result.graph.nodes) {
      const deps = node.dependsOn.length > 0 ? ` → [${node.dependsOn.join(", ")}]` : "";
      const status = node.resolution.status;
      const score = node.resolution.ambiguityScore.toFixed(3);

      // Get main theme/target
      let mainArg = "";
      if (node.ir.args.THEME) {
        const theme = node.ir.args.THEME;
        if (theme.kind === "entity") {
          mainArg = theme.entityType;
        } else if (theme.kind === "value") {
          mainArg = String(theme.raw).substring(0, 30);
        }
      } else if (node.ir.args.TARGET) {
        const target = node.ir.args.TARGET;
        if (target.kind === "entity") {
          mainArg = target.entityType;
        }
      }

      console.log(`  [${node.id}] ${node.ir.event.lemma} ${mainArg ? `(${mainArg})` : ""} - ${node.ir.event.class}${deps}`);
    }

    // Evaluation
    console.log(`\n${"─".repeat(70)}`);
    console.log("📈 Evaluation:");

    const nodeCountOk = result.graph.nodes.length >= testCase.expectedMinNodes;
    console.log(`  - Node count: ${nodeCountOk ? "✅" : "❌"} (${result.graph.nodes.length} >= ${testCase.expectedMinNodes})`);

    const hasDeps = result.graph.nodes.some(n => n.dependsOn.length > 0);
    console.log(`  - Has dependencies: ${hasDeps ? "✅" : "⚠️"}`);

    const avgAmbiguity = result.graph.nodes.reduce((sum, n) => sum + n.resolution.ambiguityScore, 0) / result.graph.nodes.length;
    console.log(`  - Avg ambiguity: ${avgAmbiguity.toFixed(3)}`);

    if (result.warnings.length > 0) {
      console.log(`  - Warnings: ${result.warnings.map(w => w.code).join(", ")}`);
    }

    const throughput = (inputLength / (elapsed / 1000)).toFixed(0);
    console.log(`  - Throughput: ${throughput} chars/sec`);

    // Success is determined by meeting expected node count
    const success = nodeCountOk;
    if (!success) {
      console.log(`\n  ❌ FAILED: Expected at least ${testCase.expectedMinNodes} nodes, got ${result.graph.nodes.length}`);
    }

    return {
      success,
      elapsed,
      nodes: result.graph.nodes.length,
      expectedNodes: testCase.expectedMinNodes,
      inputLength,
      hasDeps,
      avgAmbiguity,
      throughput: parseInt(throughput),
      // Full result for JSON export
      graph: result.graph,
      warnings: result.warnings,
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`\n❌ Error (${(elapsed / 1000).toFixed(2)}s): ${error.message}`);

    if (error.message.includes("token") || error.message.includes("length")) {
      console.log("   ⚠️ Input may exceed token limit");
    }

    return {
      success: false,
      elapsed,
      error: error.message,
      inputLength,
    };
  }
}

async function main() {
  console.log("🔥 EXTREME HEAVY INPUT EVALUATION");
  console.log("Testing translator with real-world heavy inputs...\n");
  console.log(`Total test cases: ${extremeTestCases.length}`);

  const results = [];
  const jsonResults = [];
  let totalTime = 0;
  let totalChars = 0;

  for (let i = 0; i < extremeTestCases.length; i++) {
    const testCase = extremeTestCases[i];
    const result = await runExtremeTest(testCase, i);
    results.push({ name: testCase.name, ...result });
    totalTime += result.elapsed;
    totalChars += result.inputLength;

    // Collect detailed JSON result
    jsonResults.push({
      name: testCase.name,
      description: testCase.description,
      input: testCase.input,
      expectedMinNodes: testCase.expectedMinNodes,
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
  console.log(`\n${"=".repeat(70)}`);
  console.log("📊 EXTREME TEST SUMMARY");
  console.log(`${"=".repeat(70)}`);

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nResults: ${passed}/${results.length} passed, ${failed} failed`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Total input: ${totalChars.toLocaleString()} characters`);
  console.log(`Average time: ${(totalTime / results.length / 1000).toFixed(2)}s per test`);

  const successResults = results.filter(r => r.success && r.nodes);
  if (successResults.length > 0) {
    const avgNodes = successResults.reduce((s, r) => s + r.nodes, 0) / successResults.length;
    const avgThroughput = successResults.reduce((s, r) => s + r.throughput, 0) / successResults.length;
    console.log(`Average nodes (passed): ${avgNodes.toFixed(1)} per test`);
    console.log(`Average throughput: ${avgThroughput.toFixed(0)} chars/sec`);
  }

  console.log(`\n${"─".repeat(70)}`);
  console.log("| Test | Status | Time | Nodes | Expected | Input Size |");
  console.log("|------|--------|------|-------|----------|------------|");
  for (const r of results) {
    const status = r.success ? "✅" : "❌";
    const time = `${(r.elapsed / 1000).toFixed(2)}s`;
    const nodes = r.nodes ?? "-";
    const expected = r.expectedNodes ?? "-";
    const size = `${(r.inputLength / 1000).toFixed(1)}k`;
    console.log(`| ${r.name.substring(0, 25).padEnd(25)} | ${status} | ${time.padStart(6)} | ${String(nodes).padStart(5)} | ${String(expected).padStart(8)} | ${size.padStart(10)} |`);
  }

  // Detailed failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log(`\n${"─".repeat(70)}`);
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

  const jsonPath = resolve(outputDir, `extreme-eval-${timestamp}.json`);
  const jsonOutput = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      totalTime,
      totalChars,
      avgTimePerTest: totalTime / results.length,
    },
    tests: jsonResults,
  };

  writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`\n📁 JSON results saved to: ${jsonPath}`);
}

main().catch(console.error);
