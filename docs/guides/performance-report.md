# Performance Report

> **Status:** Snapshot
> **Last Updated:** 2026-01-03
> **Scope:** Local benchmarks for Core, Host, and World

---

## Summary

- Core + Host runs 3.5 ms to 8.6 ms avg latency per intent under compute-heavy flows.
- World adds governance overhead and increases tail latency, but remains within ~9 to 21 ms p99 in tested scenarios.
- Memory growth is modest under snapshot retention, and mostly attributable to retained snapshots and in-memory world history.

---

## Environment

- Node: v22.11.0
- Platform: darwin arm64
- CPU: unknown (os.cpus() returned empty)
- Memory: 16 GB

---

## Methodology

- Benchmark script: `scripts/bench-core-host-world.mjs`
- Deterministic context: `now = 0`, `randomSeed = "bench"`
- Effect handlers: no-op (return empty patches)
- Warmup before measurement to reduce JIT noise
- Memory sampling uses `process.memoryUsage()` without forced GC

---

## Scenarios

### SaaS Small
- mode: both (Host, World)
- iterations: 1000
- warmup: 100
- arraySize: 256
- effects: false
- runs: 3 (averaged)

### Orchestrator
- mode: both (Host, World)
- iterations: 1000
- warmup: 100
- arraySize: 1024
- effects: true
- runs: 3 (averaged)

### Extreme
- mode: both (Host, World)
- iterations: 2000
- warmup: 200
- arraySize: 2048
- effects: true
- runs: 1

---

## Latency and Throughput

Numbers are averages across runs (except Extreme, which is a single run).

| Scenario | Mode | Avg (ms) | p95 (ms) | p99 (ms) | ops/s |
| --- | --- | ---: | ---: | ---: | ---: |
| SaaS Small | Host | 3.52 | 4.40 | 7.11 | 284.03 |
| SaaS Small | World | 3.82 | 4.71 | 5.70 | 260.11 |
| Orchestrator | Host | 7.49 | 8.68 | 10.57 | 133.75 |
| Orchestrator | World | 9.02 | 14.08 | 21.24 | 112.99 |
| Extreme | Host | 8.55 | 12.46 | 18.37 | 116.90 |
| Extreme | World | 9.07 | 10.13 | 11.19 | 109.85 |

---

## Memory Trends (World + Snapshot Retention)

This run samples memory every 50 iterations while retaining snapshots to simulate accumulation.

- mode: world
- iterations: 2000
- warmup: 200
- arraySize: 1024
- effects: true
- memSampleEvery: 50
- retained snapshots: 40

**Heap and RSS (sampled):**
- heapUsed: 29.33 MB -> 47.75 MB (peak 51.89 MB, delta +18.42 MB)
- rss: 103.80 MB -> 151.91 MB (peak 151.91 MB, delta +48.11 MB)

Notes:
- Snapshot retention is artificial pressure. Without retention, growth should flatten.
- World uses an in-memory lineage by default, which also grows with history length.

---

## Interpretation

- The measured latencies are within a practical range for SaaS backends and agent orchestrators with compute-heavy flows.
- World adds governance and lineage overhead, which shows up in tail latency (p95/p99) and memory growth under retention.
- For self-improving agents, stability depends on explicit retention policies and persistent storage for history to avoid unbounded in-memory growth.

---

## Reproduce

Prereq: `pnpm build` (benchmarks use `packages/*/dist`)

```bash
# SaaS small
node scripts/bench-core-host-world.mjs \
  --mode both --iterations 1000 --warmup 100 --array-size 256 --no-effects \
  --json .bench/saas-small.json

# Orchestrator
node scripts/bench-core-host-world.mjs \
  --mode both --iterations 1000 --warmup 100 --array-size 1024 --effects \
  --json .bench/orchestrator.json

# Extreme
node scripts/bench-core-host-world.mjs \
  --profile extreme --mode both --json .bench/extreme.json

# Memory sampling (World only, with snapshot retention)
node scripts/bench-core-host-world.mjs \
  --mode world --iterations 2000 --warmup 200 --array-size 1024 --effects \
  --mem --mem-sample-every 50 --retain-snapshots \
  --json .bench/world-mem.json
```

---

## Limitations

- Results vary by CPU, Node version, and OS scheduling.
- Memory sampling is approximate and does not force GC.
- World is using in-memory storage; production deployments should persist lineage.
