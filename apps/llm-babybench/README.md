# @manifesto-ai/llm-babybench

> LLM Agent Benchmark Suite based on LLM-BabyBench Dataset

BabyBench는 [HuggingFace LLM-BabyBench](https://huggingface.co/datasets/salem-mbzuai/LLM-BabyBench) 데이터셋을 기반으로 LLM 에이전트의 추론 능력을 평가하는 벤치마크 스위트입니다.

## 데이터셋 개요

| Config | 설명 | 태스크 수 | Necessity Level |
|--------|------|----------|-----------------|
| **predict** | 액션 시퀀스 실행 후 최종 상태 예측 | 8,000 | Level 0 (결정론적) |
| **plan** | 목표 달성을 위한 액션 시퀀스 생성 | 8,000 | Level 1 (계획) |
| **decompose** | 복잡한 태스크를 서브태스크로 분해 | 8,000 | Level 2 (분해) |

## 설치

```bash
pnpm add @manifesto-ai/llm-babybench
```

## 빠른 시작

### 1. 데이터셋 로드

```typescript
import { loadDataset, loadRow, getDatasetMetadata } from "@manifesto-ai/llm-babybench";

// 전체 메타데이터 조회
const metadata = await getDatasetMetadata("plan");
console.log(`Total rows: ${metadata.totalRows}`);

// 특정 row 로드
const row = await loadRow("plan", 0);
console.log(row.level_name, row.mission);

// 여러 row 로드
const rows = await loadDataset("predict", { limit: 100 });
```

### 2. Lab 모드 (인터랙티브)

```bash
# Plan 태스크 #0 실행
npx tsx examples/run-lab.ts plan 0

# 랜덤 태스크
npx tsx examples/run-lab.ts predict --random
```

### 3. 에이전트 벤치마크

```typescript
import {
  createAgentAdapter,
  BabyBench,
  loadDataset,
  rowToTask,
  registerTask,
} from "@manifesto-ai/llm-babybench";

// 에이전트 생성
const agent = createAgentAdapter({
  id: "my-agent",
  meta: { model: "gpt-4" },

  async selectAction(snapshot, context) {
    const state = snapshot.state;
    // 상태 분석 및 액션 결정
    return {
      action: { type: "forward" },
      usedLLM: true,
    };
  },
});

// 태스크 로드 및 실행
const rows = await loadDataset("plan", { limit: 10 });
for (const row of rows) {
  const task = rowToTask(row, "plan");
  registerTask(task, "plan");
  const result = await BabyBench.runTask(agent, task.id);
  console.log(`${task.id}: ${result.outcome}`);
}
```

## BabyAI 환경

### 그리드 월드

- **크기**: 8x8 (벽 포함)
- **방향**: 0=동, 1=남, 2=서, 3=북
- **오브젝트**: key, ball, box (다양한 색상)

### 가능한 액션

| 액션 | 설명 |
|------|------|
| `left` | 왼쪽으로 회전 |
| `right` | 오른쪽으로 회전 |
| `forward` | 앞으로 이동 |
| `pickup` | 오브젝트 줍기 |
| `drop` | 오브젝트 놓기 |
| `toggle` | 문 열기/닫기 |
| `done` | 태스크 완료 |

## API Reference

### 데이터셋 로더

```typescript
// 데이터셋 로드
loadDataset(config: DatasetConfig, options?: DatasetLoadOptions): Promise<BabyBenchRow[]>

// 단일 row 로드
loadRow(config: DatasetConfig, index: number): Promise<BabyBenchRow>

// 메타데이터 조회
getDatasetMetadata(config: DatasetConfig): Promise<DatasetMetadata>

// 캐시 관리
clearCache(config?: DatasetConfig): void
isCached(config: DatasetConfig): boolean
downloadDataset(config: DatasetConfig, onProgress?: Function): Promise<number>
```

### 파서

```typescript
// 환경 설명 파싱
parseEnvDescription(desc: string): ParsedEnvironment

// 초기 상태 파싱
parseInitialState(stateStr: string): ParsedInitialState

// 액션 시퀀스 파싱
parseActionSequence(seq: string): string[]
```

### 태스크 관리

```typescript
// Row → Task 변환
rowToTask(row: BabyBenchRow, config: DatasetConfig): BenchmarkTask

// 태스크 등록
registerTask(task: BenchmarkTask, config: DatasetConfig): void

// 태스크 조회
loadTask(taskId: string): BenchmarkTask | undefined
loadAllTasks(): BenchmarkTask[]
loadLevelTasks(level: NecessityLevel): BenchmarkTask[]
loadConfigTasks(config: DatasetConfig): BenchmarkTask[]
```

## 예제 파일

```
examples/
├── test-dataset.ts     # 데이터셋 로더 테스트
└── run-lab.ts          # 인터랙티브 Lab 모드
```

## 데이터셋 Row 구조

```typescript
interface BabyBenchRow {
  level_name: string;        // "BabyAI-GoToObj-v0"
  seed: number;
  env_description: string;   // 자연어 환경 설명
  initial_state: string;     // "((3, 4), 3)"

  // decompose config
  mission?: string;
  help_count?: number;

  // plan config
  target_subgoal?: string;
  expert_action_sequence?: string;

  // predict config
  action_sequence?: string;
  target_state?: string;
}
```

## 라이선스

MIT License

## 참조

- [LLM-BabyBench Dataset](https://huggingface.co/datasets/salem-mbzuai/LLM-BabyBench)
- [BabyAI Platform](https://github.com/mila-iqia/babyai)
