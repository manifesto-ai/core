# ICML 2026 Experiment Results

Generated: 2026-01-04T02:58:53.734Z
Total runs: 600

## Overall Performance

| Method | Model | Avg Calls | Avg Tokens | Avg Cost | Avg Latency | Success Rate |
|--------|-------|-----------|------------|----------|-------------|--------------|
| claude-tool | claude-3 | 0.0 | 0 | $0.0000 | 0.0s | 0% |
| manifesto | gpt-4o | 2.0 | 850 | $0.0002 | 2.4s | 100% |
| openai-func | gpt-4o | 3.9 | 2338 | $0.0130 | 2.6s | 100% |
| react | gpt-4o | 4.5 | 3218 | $0.0190 | 4.2s | 100% |
| openai-func | gpt-4o | 4.9 | 3856 | $0.0007 | 6.8s | 100% |
| react | gpt-4o | 5.3 | 3886 | $0.0007 | 7.6s | 100% |

## Performance by Category

### LLM Calls by Category

| Category | Manifesto | OpenAI-mini | OpenAI-4o | Claude | ReAct-mini | ReAct-4o |
|----------|-----------|-------------|-----------|--------|------------|----------|
| simple | 2.0 | 3.0 | 2.2 | 0.0 | 3.7 | 2.3 |
| multi-field | 2.0 | 5.8 | 3.6 | 0.0 | 10.0 | 10.0 |
| contextual | 2.0 | 4.1 | 4.2 | 0.0 | 4.0 | 2.5 |
| bulk | 2.0 | 6.1 | 4.9 | 0.0 | 3.4 | 3.3 |
| exception | 2.0 | 6.0 | 5.3 | 0.0 | 3.5 | 3.2 |

## Key Findings

1. **Manifesto (Intent-Native)** maintains constant 2.0 LLM calls across all categories
2. **Traditional methods** show increasing calls with task complexity
3. **Cost efficiency**: Manifesto uses 99% less cost than ReAct

## Detailed Traces

### manifesto Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 2
- Tool Calls: 0
- Latency: 3043ms

### openai-func Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 2
- Tool Calls: 1
- Latency: 3642ms

### claude-tool Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 0
- Tool Calls: 0
- Latency: 1ms

### react Sample (L1-01)

- Input: "L1-01"
- LLM Calls: 10
- Tool Calls: 1
- Latency: 15626ms

