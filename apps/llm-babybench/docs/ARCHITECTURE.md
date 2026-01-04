# LLM-BabyBench 아키텍처 분석

> **Version:** 1.0
> **Last Updated:** 2026-01-03
> **Package:** `@manifesto-ai/llm-babybench`

---

## 1. 프로젝트 개요

### 1.1 목적

LLM-BabyBench는 Manifesto 프레임워크 기반의 LLM 에이전트 벤치마크 시스템입니다.
BabyAI Grid World 환경에서 LLM 사용의 **구조적 필요성(Structural Necessity)**을 측정합니다.

### 1.2 통계

| 항목 | 값 |
|------|-----|
| 총 코드 라인 | 3,494 lines |
| 소스 파일 수 | 12 files |
| 주요 모듈 | 4 (domain, bench, actors, dataset) |
| 데이터셋 | HuggingFace `salem-mbzuai/LLM-BabyBench` |
| 총 태스크 수 | 24,000 (8,000 x 3 configs) |

### 1.3 의존성

```json
{
  "@manifesto-ai/core": "^1.0.0",
  "@manifesto-ai/host": "^1.0.0",
  "@manifesto-ai/world": "^1.0.0",
  "@manifesto-ai/builder": "^1.0.0",
  "@manifesto-ai/lab": "^1.0.0",
  "openai": "^4.0.0",
  "zod": "^4.0.0"
}
```

---

## 2. 디렉토리 구조

```
llm-babybench/
├── src/
│   ├── domain/              # BabyAI 도메인 정의
│   │   ├── schema.ts        # Zod 스키마 (Grid, Agent, Objects)
│   │   ├── domain.ts        # Builder API로 액션 정의
│   │   └── index.ts         # Public exports
│   │
│   ├── bench/               # 벤치마크 실행 엔진
│   │   ├── setup.ts         # World 생성, Host 캡슐화
│   │   ├── runner.ts        # 태스크 실행 루프
│   │   ├── effects.ts       # 이펙트 핸들러 (move, pickup, drop, toggle)
│   │   └── index.ts         # Public exports
│   │
│   ├── actors/              # 에이전트 구현체
│   │   ├── bfs-actor.ts     # 결정론적 경로 탐색 (956 lines)
│   │   ├── llm-actor.ts     # 전체 LLM 기반 (146 lines)
│   │   ├── hybrid-actor.ts  # LLM 계획 + BFS 실행 (457 lines)
│   │   └── index.ts         # Public exports
│   │
│   ├── dataset/             # 데이터셋 로딩 및 파싱
│   │   ├── types.ts         # 데이터 타입 정의
│   │   ├── loader.ts        # HuggingFace API 연동
│   │   ├── parser.ts        # 환경/상태 파싱
│   │   └── index.ts         # Public exports
│   │
│   ├── __tests__/           # 테스트
│   │   └── dataset.test.ts  # 파서 유닛 테스트
│   │
│   └── index.ts             # 메인 패키지 exports
│
├── docs/                    # 문서
│   ├── SPEC.md              # 전체 스펙 (45KB)
│   ├── FDR.md               # 설계 근거
│   ├── EXPERIMENTS.md       # 실험 결과
│   ├── PAPER_ANALYSIS.md    # 논문 분석
│   └── ARCHITECTURE.md      # 이 문서
│
├── examples/                # CLI 예제
│   ├── run-benchmark.ts     # 벤치마크 실행
│   ├── interactive-mode.ts  # HITL 모드
│   └── debug-runner.ts      # 디버그 유틸
│
├── benchmark-reports/       # 벤치마크 결과 JSON
└── .cache/                  # 데이터셋 캐시
```

### 모듈별 코드 규모

| 모듈 | 파일 수 | 라인 수 | 복잡도 |
|------|---------|---------|--------|
| domain | 2 | ~140 | Low |
| bench | 3 | ~781 | Medium |
| actors | 3 | ~1,559 | High |
| dataset | 3 | ~521 | Medium |
| tests | 1 | ~107 | Low |
| **합계** | **12** | **~3,494** | |

---

## 3. 핵심 모듈 분석

### 3.1 Domain 모듈

#### 3.1.1 스키마 정의 (`schema.ts`)

```typescript
// Grid 스키마
export const GridSchema = z.object({
  width: z.number(),
  height: z.number(),
  cells: z.array(z.array(z.enum(["empty", "wall", "floor"]))),
});

// Agent 스키마
export const AgentSchema = z.object({
  x: z.number(),
  y: z.number(),
  direction: z.number(),  // 0=East, 1=South, 2=West, 3=North
  carrying: CarriedObjectSchema.nullable(),
});

// 전체 상태 스키마
export const BabyAIStateSchema = z.object({
  grid: GridSchema,
  agent: AgentSchema,
  objects: z.array(WorldObjectSchema),
  mission: z.string(),
  steps: z.number(),
  maxSteps: z.number(),
  goalReached: z.boolean(),
});
```

#### 3.1.2 도메인 액션 (`domain.ts`)

```typescript
export const BabyAIDomain = defineDomain(
  BabyAIStateSchema,
  ({ state, computed, actions, expr, flow }) => {

    // 순수 패치 액션 (이펙트 없음)
    const { turnLeft, turnRight } = actions.define({
      turnLeft: {
        flow: flow.patch(state.agent.direction).set(
          expr.mod(expr.add(state.agent.direction, 3), 4)
        ),
      },
      turnRight: {
        flow: flow.patch(state.agent.direction).set(
          expr.mod(expr.add(state.agent.direction, 1), 4)
        ),
      },
    });

    // 이펙트 기반 액션 (Host가 실행)
    const { moveForward } = actions.define({
      moveForward: {
        flow: flow.effect("babyai:move", {
          x: state.agent.x,
          y: state.agent.y,
          direction: state.agent.direction,
        }),
      },
    });

    // 가드 표현식을 통한 액션 가용성
    const { pickup } = actions.define({
      pickup: {
        available: canPickup,  // Computed 표현식
        flow: flow.effect("babyai:pickup", { ... }),
      },
    });
  }
);
```

**7개 도메인 액션:**

| 액션 | 유형 | 설명 |
|------|------|------|
| `turnLeft` | 순수 패치 | 방향 -90도 회전 |
| `turnRight` | 순수 패치 | 방향 +90도 회전 |
| `moveForward` | 이펙트 | 앞으로 이동 (충돌 검사) |
| `pickup` | 이펙트 | 앞의 객체 집기 |
| `drop` | 이펙트 | 들고 있는 객체 내려놓기 |
| `toggle` | 이펙트 | 문 열기/닫기 |
| `done` | 순수 패치 | 태스크 완료 신호 |

---

### 3.2 Bench 모듈

#### 3.2.1 World 생성 (`setup.ts`)

```typescript
export interface BenchWorld {
  world: ManifestoWorld;  // 외부에 노출되는 유일한 인터페이스
  schemaHash: string;
}

export function createBenchWorld(initialState: BabyAIState): BenchWorld {
  // Host는 내부에서만 생성 (외부에 노출 안 함)
  const host = createHost(BabyAIDomain.schema, {
    initialData: initialState,
  });

  // 이펙트 핸들러 등록
  for (const [type, handler] of Object.entries(effectHandlers)) {
    host.registerEffect(type, handler);
  }

  // Host를 HostInterface로 래핑
  const hostInterface: HostInterface = {
    async dispatch(intent, loopOptions) {
      const result = await host.dispatch(intent, {
        ...loopOptions,
        maxIterations: 1,  // BabyAI: 한 액션 = 한 스텝
      });
      return {
        status: result.status === "complete" ? "complete" : "error",
        snapshot: result.snapshot,
      };
    },
  };

  // World만 외부에 노출
  const world = new ManifestoWorld({ schemaHash, host: hostInterface });
  return { world, schemaHash };
}
```

**핵심 설계 원칙: Sovereign Separation**
- Host는 완전히 캡슐화됨
- 외부 코드는 오직 `world.submitProposal()`만 사용
- Host 구현이 변경되어도 외부 API는 유지

#### 3.2.2 태스크 실행 (`runner.ts`)

```typescript
export async function runTask(task: BenchTask, actor: Actor): Promise<TaskResult> {
  // 1. World 생성
  const { world, schemaHash } = createBenchWorld(task.initialState);

  // 2. Actor 등록 (auto-approve 정책)
  registerActor(world, actor.id);

  // 3. 초기 스냅샷 생성
  const initialSnapshot = createTaskSnapshot(task.initialState);
  const genesis = await world.createGenesis(initialSnapshot);
  let currentWorldId = genesis.worldId;

  // 4. 메인 루프 (최대 100 스텝)
  while (step < maxSteps) {
    // 스냅샷에서 상태 읽기
    const snapshot = await world.getSnapshot(currentWorldId);
    const state = snapshot.data as BabyAIState;

    // 목표 도달 확인
    if (state.goalReached) {
      return { outcome: "success", steps: step };
    }

    // Actor에게 액션 제안 요청
    const context = { task, step, availableActions: getAvailableActions(state) };
    const proposal = await actor.proposeAction(state, context);

    // Intent 생성 및 World에 제출
    const intent = await createIntentInstance({
      body: { type: proposal.action, input: {} },
      schemaHash,
      source: { kind: "agent", eventId: `step-${step}` },
      actor: { actorId: actor.id, kind: "agent" },
    });

    const result = await world.submitProposal(actor.id, intent, currentWorldId);

    // 새 World ID 업데이트
    if (result.resultWorld) {
      currentWorldId = result.resultWorld.worldId;
    }
    step++;
  }

  return { outcome: "timeout", steps: step };
}
```

#### 3.2.3 이펙트 핸들러 (`effects.ts`)

```typescript
// 이동 핸들러
export const moveHandler: EffectHandler = async (_type, params, context) => {
  const state = context.snapshot.data as BabyAIState;
  const front = getFrontPosition(params.x, params.y, params.direction);

  // 이동 불가: 스텝만 증가
  if (!isWalkable(front.x, front.y, state)) {
    return [{ op: "set", path: "steps", value: state.steps + 1 }] as Patch[];
  }

  // 이동 가능: 위치 업데이트
  return [
    { op: "set", path: "agent.x", value: front.x },
    { op: "set", path: "agent.y", value: front.y },
    { op: "set", path: "steps", value: state.steps + 1 },
  ] as Patch[];
};

// 집기 핸들러
export const pickupHandler: EffectHandler = async (_type, params, context) => {
  const state = context.snapshot.data as BabyAIState;

  if (state.agent.carrying !== null) {
    return [{ op: "set", path: "steps", value: state.steps + 1 }] as Patch[];
  }

  const front = getFrontPosition(params.x, params.y, params.direction);
  const found = findObjectAt(front.x, front.y, state.objects);

  if (!found || found.object.type === "door") {
    return [{ op: "set", path: "steps", value: state.steps + 1 }] as Patch[];
  }

  // 객체 집기: carrying 설정, objects에서 제거
  const newObjects = [...state.objects];
  newObjects.splice(found.index, 1);

  return [
    { op: "set", path: "agent.carrying", value: { type: found.object.type, color: found.object.color } },
    { op: "set", path: "objects", value: newObjects },
    { op: "set", path: "steps", value: state.steps + 1 },
  ] as Patch[];
};
```

**4개 이펙트 핸들러:**

| 핸들러 | 이펙트 타입 | 역할 |
|--------|------------|------|
| `moveHandler` | `babyai:move` | 충돌 검사 후 이동 |
| `pickupHandler` | `babyai:pickup` | 객체 집기 |
| `dropHandler` | `babyai:drop` | 객체 내려놓기 |
| `toggleHandler` | `babyai:toggle` | 문 열기/닫기 |

**Constitution 준수:**
- 모든 핸들러는 `Patch[]` 반환
- 예외를 던지지 않음 (에러도 패치로 표현)
- 순수 함수 (동일 입력 → 동일 출력)

---

### 3.3 Actors 모듈

#### 3.3.1 Actor 인터페이스

```typescript
export interface Actor {
  id: string;
  proposeAction(state: BabyAIState, context: TaskContext): Promise<ActorProposal>;
  reset?(): void;
}

export interface ActorProposal {
  action: BabyAIAction;
  reasoning?: string;
}

export interface TaskContext {
  task: BenchTask;
  step: number;
  availableActions: BabyAIAction[];
}
```

#### 3.3.2 BFS Actor (결정론적)

```typescript
// bfs-actor.ts - 956 lines
export function createBFSActor(options: BFSActorOptions = {}): Actor {
  // 내부 상태
  let currentPath: BabyAIAction[] = [];
  let pathIndex = 0;
  let subMissions: string[] = [];
  let currentMissionIndex = 0;

  return {
    id: "bfs",

    async proposeAction(state, context) {
      // 1. 복합 미션 분리 ("X and Y", "X then Y")
      if (!initialized) {
        subMissions = splitCompoundMission(state.mission);
        initialized = true;
      }

      // 2. 현재 서브 미션의 목표 찾기
      const target = findTarget(state, subMissions[currentMissionIndex], context);

      // 3. BFS로 경로 계산
      if (currentPath.length === 0) {
        currentPath = bfsPath(state, target);
        pathIndex = 0;
      }

      // 4. 경로 따라 액션 반환
      if (pathIndex < currentPath.length) {
        return { action: currentPath[pathIndex++] };
      }

      // 5. 최종 액션 (pickup, toggle 등)
      return { action: getFinalAction(target.type) };
    },

    reset() {
      currentPath = [];
      pathIndex = 0;
      subMissions = [];
      currentMissionIndex = 0;
    },
  };
}
```

**BFS 알고리즘:**
```typescript
function bfsPath(state: BabyAIState, target: TargetGoal): BabyAIAction[] {
  const queue: Array<{ pos: Position, dir: number, path: BabyAIAction[] }> = [
    { pos: { x: state.agent.x, y: state.agent.y }, dir: state.agent.direction, path: [] }
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.pos.x},${current.pos.y},${current.dir}`;

    if (visited.has(key)) continue;
    visited.add(key);

    // 목표 도달 확인 (인접 또는 정확한 위치)
    if (isAtTarget(current.pos, current.dir, target)) {
      return current.path;
    }

    // 앞으로 이동 시도
    const front = getFrontPosition(current.pos.x, current.pos.y, current.dir);
    if (isWalkable(front.x, front.y, state)) {
      queue.push({
        pos: front,
        dir: current.dir,
        path: [...current.path, "moveForward"],
      });
    }

    // 회전 시도
    queue.push({
      pos: current.pos,
      dir: (current.dir + 1) % 4,
      path: [...current.path, "turnRight"],
    });
    queue.push({
      pos: current.pos,
      dir: (current.dir + 3) % 4,
      path: [...current.path, "turnLeft"],
    });
  }

  return [];  // 경로 없음
}
```

**지원하는 미션 유형:**
- 단순: "go to COLOR TYPE", "pick up COLOR TYPE", "open COLOR door"
- 상대 위치: "...in front of you", "...behind you", "...on your left/right"
- 복합: "X and Y", "X then Y", "after you X, Y"
- 다단계: "put COLOR1 TYPE1 next to COLOR2 TYPE2"

#### 3.3.3 LLM Actor (전체 LLM)

```typescript
// llm-actor.ts - 146 lines
export function createLLMActor(options: LLMActorOptions = {}): Actor {
  const { model = "gpt-4o-mini", temperature = 0.2 } = options;
  const client = new OpenAI();

  return {
    id: `llm-${model}`,

    async proposeAction(state, context) {
      const prompt = buildPrompt(state, context.availableActions);

      try {
        const response = await client.chat.completions.create({
          model,
          temperature,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        const result = JSON.parse(content);

        // 액션 검증
        if (context.availableActions.includes(result.action)) {
          return { action: result.action, reasoning: result.reasoning };
        }

        return { action: "turnRight" };  // 폴백
      } catch (error) {
        return { action: "done", reasoning: "LLM error" };
      }
    },
  };
}
```

#### 3.3.4 Hybrid Actor (LLM 계획 + BFS 실행)

```typescript
// hybrid-actor.ts - 457 lines
export function createHybridActor(options: HybridActorOptions = {}): Actor {
  const { model = "gpt-4o-mini", temperature = 0.2 } = options;

  let plan: Target | null = null;
  let hasPlanned = false;
  let currentPath: BabyAIAction[] = [];
  let pathIndex = 0;

  return {
    id: `hybrid-${model}`,

    async proposeAction(state, context) {
      // Phase 1: 계획 (1회 LLM 호출)
      if (!hasPlanned) {
        hasPlanned = true;

        // predict config: LLM 스킵, target_state 직접 사용
        if (context.task.config === "predict" && context.task.row.target_state) {
          const target = parseInitialState(context.task.row.target_state);
          currentPath = bfsPath(state, { x: target.x, y: target.y, exactDirection: target.direction });
          pathIndex = 0;
          // 첫 액션 반환
        }

        // 다른 config: LLM으로 목표 분석
        plan = await getPlanFromLLM(state, model, temperature);

        if (!plan) {
          return { action: "done", reasoning: "Planning failed" };
        }

        // 목표 객체 찾기 및 경로 계산
        const target = state.objects.find(o => o.type === plan.objectType && o.color === plan.color);
        currentPath = bfsPath(state, { x: target.x, y: target.y });
        pathIndex = 0;
      }

      // Phase 2: 결정론적 실행
      if (pathIndex < currentPath.length) {
        return { action: currentPath[pathIndex++] };
      }

      // 최종 액션
      if (plan?.type === "pick_up") {
        return { action: "pickup" };
      }
      return { action: "done" };
    },

    reset() {
      plan = null;
      hasPlanned = false;
      currentPath = [];
      pathIndex = 0;
    },
  };
}
```

#### 3.3.5 Actor 비교

| 특성 | BFS Actor | LLM Actor | Hybrid Actor |
|------|-----------|-----------|--------------|
| **LLM 호출** | 0 | 매 스텝 | 1회 (계획) |
| **결정론성** | 완전 | 없음 | 실행 단계만 |
| **비용** | 무료 | 매우 높음 | 낮음 |
| **코드 복잡도** | 956 LOC | 146 LOC | 457 LOC |
| **미션 파싱** | 직접 구현 | LLM 위임 | LLM 위임 |
| **재현 가능성** | 완전 | 낮음 | 높음 |
| **Constitution 정합** | 최적 | 비정합 | 정합 |

---

### 3.4 Dataset 모듈

#### 3.4.1 타입 정의 (`types.ts`)

```typescript
export type DatasetConfig = "decompose" | "plan" | "predict";

export interface BabyBenchRow {
  level_name: string;              // "BabyAI-GoToObj-v0"
  seed: number;
  env_description: string;         // 자연어 환경 설명
  initial_state: string;           // "((x, y), direction)"
  mission?: string;                // 미션 텍스트
  target_subgoal?: string;         // plan: 목표 좌표/객체
  expert_action_sequence?: string; // plan: 정답 액션 시퀀스
  action_sequence?: string;        // predict: 실행할 액션
  target_state?: string;           // predict: 기대 최종 상태
}
```

#### 3.4.2 데이터 로더 (`loader.ts`)

```typescript
export async function loadDataset(
  config: DatasetConfig,
  options: LoadOptions = {}
): Promise<BabyBenchRow[]> {
  const { limit = 100, offset = 0, useCache = true } = options;

  // 캐시 확인
  if (useCache) {
    const cached = await loadFromCache(config, offset, limit);
    if (cached) return cached;
  }

  // HuggingFace API 호출
  const url = `https://datasets-server.huggingface.co/rows?` +
    `dataset=salem-mbzuai/LLM-BabyBench&` +
    `config=${config}&split=train&` +
    `offset=${offset}&length=${limit}`;

  const response = await fetchWithRetry(url);
  const data = await response.json();

  // 캐시 저장
  await saveToCache(config, offset, limit, data.rows);

  return data.rows.map((row: any) => row.row);
}
```

#### 3.4.3 환경 파서 (`parser.ts`)

```typescript
// 초기 상태 파싱
export function parseInitialState(stateStr: string): ParsedInitialState {
  const match = stateStr.match(/\(\((\d+),\s*(\d+)\),\s*(\d+)\)/);
  if (!match) throw new Error(`Invalid state: ${stateStr}`);
  return {
    x: parseInt(match[1]),
    y: parseInt(match[2]),
    direction: parseInt(match[3]),
  };
}

// 환경 설명 파싱
export function parseEnvDescription(desc: string): ParsedEnvironment {
  const lines = desc.split("\n");
  const result: ParsedEnvironment = {
    gridSize: { width: 8, height: 8 },
    rooms: 1,
    agent: null,
    objects: [],
    doors: [],
    mission: "",
  };

  for (const line of lines) {
    // 그리드 크기
    if (line.includes("grid")) {
      const match = line.match(/(\d+)x(\d+)/);
      if (match) {
        result.gridSize = { width: parseInt(match[1]), height: parseInt(match[2]) };
      }
    }

    // 객체 파싱
    if (line.includes("key") || line.includes("ball") || line.includes("box")) {
      result.objects.push(parseObject(line));
    }

    // 미션 파싱
    if (line.startsWith("Mission:")) {
      result.mission = line.substring(8).trim();
    }
  }

  return result;
}
```

---

## 4. Manifesto 통합 아키텍처

### 4.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          LLM-BabyBench                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────┐                                                     │
│  │    Actor      │  proposeAction(state) → ActorProposal               │
│  └───────┬───────┘                                                     │
│          │                                                              │
│          ▼                                                              │
│  ┌───────────────┐                                                     │
│  │    Runner     │  createIntentInstance() → IntentInstance            │
│  └───────┬───────┘                                                     │
│          │                                                              │
│          ▼                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                       World Protocol                               │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │  submitProposal(actorId, intent, worldId)                   │  │ │
│  │  │                                                             │  │ │
│  │  │  1. Proposal 생성                                           │  │ │
│  │  │  2. Authority 평가 (auto_approve)                           │  │ │
│  │  │  3. Host.dispatch() 호출 (내부)                             │  │ │
│  │  │  4. 새 World 기록                                           │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  │                          │                                         │ │
│  │                          ▼ (내부)                                  │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                        Host                                  │  │ │
│  │  │                                                             │  │ │
│  │  │  dispatch(intent) {                                         │  │ │
│  │  │    1. Core.compute(schema, snapshot, intent)                │  │ │
│  │  │       → patches + requirements                              │  │ │
│  │  │    2. for each requirement:                                 │  │ │
│  │  │       → effectHandler() → more patches                      │  │ │
│  │  │    3. Core.apply(schema, snapshot, allPatches)              │  │ │
│  │  │       → newSnapshot                                         │  │ │
│  │  │  }                                                          │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  │                          │                                         │ │
│  │                          ▼ (내부)                                  │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                        Core                                  │  │ │
│  │  │                                                             │  │ │
│  │  │  - 순수 계산 (IO 없음)                                       │  │ │
│  │  │  - 표현식 평가                                               │  │ │
│  │  │  - 패치 생성                                                 │  │ │
│  │  │  - 결정론적!                                                 │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                          │                                              │
│                          ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                      New Snapshot                                  │ │
│  │  {                                                                │ │
│  │    data: BabyAIState,           // 도메인 상태                    │ │
│  │    computed: { canPickup, ... }, // 계산된 값                     │ │
│  │    system: { status, ... },     // 시스템 상태                    │ │
│  │    meta: { version, hash, ... } // 메타데이터                     │ │
│  │  }                                                                │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Constitution 준수 체크리스트

| 원칙 | 구현 상태 | 상세 |
|------|----------|------|
| **Core 순수성** | ✅ | domain.ts에서 순수 액션 정의, IO 없음 |
| **Host 캡슐화** | ✅ | setup.ts에서 Host는 내부에서만 생성 |
| **World 거버넌스** | ✅ | submitProposal()이 유일한 외부 API |
| **Snapshot 유일 매체** | ✅ | 모든 상태는 snapshot.data에서 읽음 |
| **Patch 기반 변경** | ✅ | 이펙트 핸들러가 Patch[] 반환 |
| **예외 없음** | ✅ | 에러도 패치로 표현 |
| **결정론성** | ✅ | BFS Actor, 이펙트 핸들러 모두 결정론적 |
| **Zero String Path** | ✅ | state.agent.x 형태 사용 |

### 4.3 Intent 흐름 상세

```typescript
// 1. Actor가 액션 제안
const proposal: ActorProposal = await actor.proposeAction(state, context);
// → { action: "moveForward", reasoning: "Moving to target" }

// 2. Intent 인스턴스 생성
const intent: IntentInstance = await createIntentInstance({
  body: {
    type: proposal.action,  // "moveForward"
    input: {},              // BabyAI는 input 불필요
  },
  schemaHash,
  projectionId: "babybench",
  source: { kind: "agent", eventId: `step-${step}` },
  actor: { actorId: actor.id, kind: "agent" },
});

// 3. World에 제출
const result = await world.submitProposal(actor.id, intent, currentWorldId);
// 내부:
//   a) World가 Proposal 생성
//   b) Authority가 평가 (auto_approve 정책)
//   c) Host.dispatch() 호출
//      - Core.compute() → 패치 + 이펙트 요구사항
//      - 이펙트 핸들러 실행 → 추가 패치
//      - Core.apply() → 새 Snapshot
//   d) 새 World 기록

// 4. 새 World ID 획득
currentWorldId = result.resultWorld.worldId;

// 5. 다음 루프에서 새 상태 읽기
const newSnapshot = await world.getSnapshot(currentWorldId);
// → snapshot.data.agent.x가 업데이트됨
```

---

## 5. 타입 시스템

### 5.1 핵심 타입 정의

```typescript
// 도메인 상태
export type BabyAIState = z.infer<typeof BabyAIStateSchema>;

// 도메인 액션
export type BabyAIAction =
  | "turnLeft"
  | "turnRight"
  | "moveForward"
  | "pickup"
  | "drop"
  | "toggle"
  | "done";

// 벤치마크 태스크
export interface BenchTask {
  id: string;
  row: BabyBenchRow;
  config: DatasetConfig;
  initialState: BabyAIState;
}

// 태스크 결과
export interface TaskResult {
  taskId: string;
  outcome: "success" | "failure" | "timeout";
  steps: number;
  reason?: string;
}

// Actor 인터페이스
export interface Actor {
  id: string;
  proposeAction(state: BabyAIState, context: TaskContext): Promise<ActorProposal>;
  reset?(): void;
}

// Actor 제안
export interface ActorProposal {
  action: BabyAIAction;
  reasoning?: string;
}

// 태스크 컨텍스트
export interface TaskContext {
  task: BenchTask;
  step: number;
  availableActions: BabyAIAction[];
}
```

### 5.2 Public API

```typescript
// src/index.ts exports

// Domain
export { BabyAIDomain, type BabyAIState, type BabyAIAction };
export { BabyAIStateSchema, GridSchema, AgentSchema };

// Bench
export { createBenchWorld, runTask, createTask };
export type { BenchWorld, BenchTask, TaskResult };

// Actors
export { createBFSActor, createLLMActor, createHybridActor };
export type { Actor, ActorProposal, TaskContext };

// Dataset
export { loadDataset, loadRow, getDatasetMetadata };
export { parseInitialState, parseEnvDescription };
export type { DatasetConfig, BabyBenchRow };
```

---

## 6. 테스트 및 빌드

### 6.1 테스트 구조

```typescript
// __tests__/dataset.test.ts
describe("parseInitialState", () => {
  it("parses valid state string", () => {
    const result = parseInitialState("((3, 4), 2)");
    expect(result).toEqual({ x: 3, y: 4, direction: 2 });
  });

  it("throws on invalid format", () => {
    expect(() => parseInitialState("invalid")).toThrow();
  });
});

describe("parseEnvDescription", () => {
  it("extracts grid size", () => {
    const result = parseEnvDescription("The room is a 8x8 grid...");
    expect(result.gridSize).toEqual({ width: 8, height: 8 });
  });

  it("parses objects", () => {
    const result = parseEnvDescription("There is a red key at (2, 3)");
    expect(result.objects).toContainEqual({ color: "red", type: "key", x: 2, y: 3 });
  });
});
```

### 6.2 빌드 스크립트

```bash
# 컴파일
pnpm build          # tsc 컴파일

# 테스트
pnpm test           # vitest 실행
pnpm test:watch     # 워치 모드

# 벤치마크
pnpm benchmark               # 전체 벤치마크
pnpm benchmark --actor bfs   # BFS actor만
pnpm benchmark --actor llm   # LLM actor만
pnpm benchmark --config predict --limit 100  # 특정 config, 제한된 수

# 디버그
DEBUG=true pnpm benchmark    # 상세 로그
```

---

## 7. 설계 원칙

### 7.1 Sovereign Separation

```
외부 코드가 볼 수 있는 것:
  - World.submitProposal()
  - World.getSnapshot()
  - Snapshot.data

외부 코드가 볼 수 없는 것:
  - Host
  - Core.compute()
  - Core.apply()
  - Effect handlers
```

### 7.2 Determinism & Accountability

```
모든 상태 변경:
  Actor → Intent → Authority → Host → Core → Patch → Snapshot

추적 가능:
  - 누가 (actorId)
  - 무엇을 (intent.body.type)
  - 언제 (eventId, timestamp)
  - 왜 (reasoning)
```

### 7.3 Minimal LLM Necessity

```
Level 0 (predict): LLM 0회 (BFS Actor 사용)
Level 1 (plan):    LLM 1회 (Hybrid Actor 사용)
Level 2 (decompose): LLM 필수 (언어 해석)
```

### 7.4 Schema-First Design

```
모든 도메인 시맨틱:
  - Zod 스키마로 정의
  - JSON 직렬화 가능
  - TypeScript 타입 추론
  - 런타임 검증
```

---

## 8. 확장 가이드

### 8.1 새 Actor 추가

```typescript
export function createMyActor(options: MyActorOptions = {}): Actor {
  return {
    id: "my-actor",

    async proposeAction(state, context) {
      // 상태 분석
      // 액션 결정
      return { action: "moveForward", reasoning: "..." };
    },

    reset() {
      // 상태 초기화
    },
  };
}
```

### 8.2 새 이펙트 핸들러 추가

```typescript
export const myHandler: EffectHandler = async (_type, params, context) => {
  const state = context.snapshot.data as BabyAIState;

  // 로직 수행

  return [
    { op: "set", path: "my.field", value: newValue },
  ] as Patch[];
};

// setup.ts에서 등록
host.registerEffect("babyai:my-effect", myHandler);
```

### 8.3 새 미션 유형 추가 (BFS Actor)

```typescript
// bfs-actor.ts의 findTarget 함수에 추가
function findTarget(state: BabyAIState, mission: string): TargetGoal | null {
  // 기존 패턴...

  // 새 패턴 추가
  const myMatch = mission.match(/my new pattern (\w+) (\w+)/);
  if (myMatch) {
    const [_, color, type] = myMatch;
    const obj = state.objects.find(o => o.color === color && o.type === type);
    if (obj) return { x: obj.x, y: obj.y, type: "my_action" };
  }

  return null;
}
```

---

## 9. 참고 자료

- [SPEC.md](./SPEC.md) - 전체 스펙 문서
- [FDR.md](./FDR.md) - 설계 근거 문서
- [EXPERIMENTS.md](./EXPERIMENTS.md) - 실험 결과
- [PAPER_ANALYSIS.md](./PAPER_ANALYSIS.md) - 논문 분석

---

*End of Architecture Document*
