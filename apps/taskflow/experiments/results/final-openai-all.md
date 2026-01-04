# ICML 2026 Experiment Results

Generated: 2026-01-04T11:42:56.837Z
Total runs: 500

## Overall Performance

| Method | Model | Avg Calls | Avg Tokens | Avg Cost | Avg Latency | Success Rate |
|--------|-------|-----------|------------|----------|-------------|--------------|
| manifesto | gpt-4o-mini | 2.0 | 850 | $0.0002 | 2.3s | 96% |
| react | gpt-4o | 2.6 | 1472 | $0.0089 | 2.6s | 97% |
| react | gpt-4o-mini | 3.1 | 2063 | $0.0004 | 4.3s | 99% |
| openai-func | gpt-4o | 3.9 | 2366 | $0.0131 | 2.7s | 97% |
| openai-func | gpt-4o-mini | 5.6 | 6113 | $0.0010 | 8.8s | 98% |

## Performance by Category

### LLM Calls by Category

| Category | Manifesto | OpenAI-mini | OpenAI-4o | Claude | ReAct-mini | ReAct-4o |
|----------|-----------|-------------|-----------|--------|------------|----------|
| simple | 2.0 | 2.6 | 2.2 | - | 3.5 | 2.1 |
| multi-field | 2.0 | 6.5 | 3.6 | - | 2.3 | 2.3 |
| contextual | 2.0 | 4.6 | 4.4 | - | 3.4 | 2.5 |
| bulk | 2.0 | 6.8 | 5.0 | - | 3.3 | 3.3 |
| exception | 2.0 | 9.6 | 5.0 | - | 3.7 | 3.3 |

## Key Findings

1. **Manifesto (Intent-Native)** maintains constant 2.0 LLM calls across all categories
2. **Traditional methods** show increasing calls with task complexity
3. **Cost efficiency**: Manifesto uses 98% less cost than ReAct

## Detailed Traces

### manifesto Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 2
- Tool Calls: 1
- Latency: 2268ms

### openai-func Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 2
- Tool Calls: 1
- Latency: 3243ms

### react Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 3
- Tool Calls: 2
- Latency: 5982ms

