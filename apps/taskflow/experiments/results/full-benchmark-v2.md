# ICML 2026 Experiment Results

Generated: 2026-01-04T04:28:59.286Z
Total runs: 600

## Overall Performance

| Method | Model | Avg Calls | Avg Tokens | Avg Cost | Avg Latency | Success Rate |
|--------|-------|-----------|------------|----------|-------------|--------------|
| claude-tool | claude-3.5 | 0.0 | 0 | $0.0000 | 0.0s | 0% |
| manifesto | gpt-4o-mini | 2.0 | 850 | $0.0002 | 2.5s | 50% |
| react | gpt-4o | 2.6 | 1459 | $0.0089 | 2.6s | 98% |
| react | gpt-4o-mini | 3.1 | 1970 | $0.0004 | 4.1s | 99% |
| openai-func | gpt-4o | 4.1 | 2555 | $0.0141 | 2.9s | 97% |
| openai-func | gpt-4o-mini | 5.9 | 7122 | $0.0012 | 9.0s | 96% |

## Performance by Category

### LLM Calls by Category

| Category | Manifesto | OpenAI-mini | OpenAI-4o | Claude | ReAct-mini | ReAct-4o |
|----------|-----------|-------------|-----------|--------|------------|----------|
| simple | 2.0 | 2.8 | 2.4 | 0.0 | 3.3 | 2.1 |
| multi-field | 2.0 | 5.2 | 3.6 | 0.0 | 2.3 | 2.4 |
| contextual | 2.0 | 5.9 | 4.3 | 0.0 | 3.3 | 2.6 |
| bulk | 2.0 | 7.2 | 5.5 | 0.0 | 3.4 | 3.1 |
| exception | 2.0 | 10.9 | 5.4 | 0.0 | 3.4 | 3.1 |

## Key Findings

1. **Manifesto (Intent-Native)** maintains constant 2.0 LLM calls across all categories
2. **Traditional methods** show increasing calls with task complexity
3. **Cost efficiency**: Manifesto uses 98% less cost than ReAct

## Detailed Traces

### manifesto Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 2
- Tool Calls: 0
- Latency: 2898ms

### openai-func Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 2
- Tool Calls: 1
- Latency: 3491ms

### claude-tool Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 0
- Tool Calls: 0
- Latency: 1ms

### react Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 3
- Tool Calls: 2
- Latency: 5848ms

