# Start Here

> Pick one track and ignore the rest for now.

The docs are intentionally wider than the first-time reading path. The mistake is trying to read them in section order.

## Choose One Track

| If You Want | Read This | Then Stop At |
|-------------|-----------|--------------|
| Build the first running app | [Quickstart](/quickstart) | [Tutorial 04](/tutorial/04-todo-app) |
| Add CLI, editor, AI, or Studio DX | [Developer Tooling](/guides/developer-tooling) | the specific package page you need |
| Add review, approval, or audit history | [When You Need Approval or History](/guides/approval-and-history) | the first advanced page that matches your need |
| Look up a known package surface | [API Reference](/api/) | the package page |

## Recommended Reading Orders

### 1. First App Track

Read this if you have not shipped anything with Manifesto yet.

1. [Quickstart](/quickstart)
2. [Tutorial Overview](/tutorial/)
3. [Tutorial 01](/tutorial/01-your-first-app)
4. [Tutorial 02](/tutorial/02-actions-and-state)
5. [Tutorial 03](/tutorial/03-effects)
6. [Tutorial 04](/tutorial/04-todo-app)

Use [Concepts](/concepts/) only when you need vocabulary clarification while following the tutorial.

### 2. Developer Tooling Track

Read this if the runtime already makes sense and the missing piece is workflow tooling.

1. [Developer Tooling](/guides/developer-tooling)
2. [@manifesto-ai/cli](/api/cli)
3. [@manifesto-ai/mel-lsp](/api/mel-lsp)
4. [@manifesto-ai/skills](/api/skills) if you use Codex or another AI coding tool
5. [@manifesto-ai/studio-cli](/api/studio-cli) or [@manifesto-ai/studio-mcp](/api/studio-mcp) when you need inspection tooling

### 3. Approval And History Track

Read this only after the base runtime path already feels normal.

1. [When You Need Approval or History](/guides/approval-and-history)
2. [Tutorial 05: Approval and History Setup](/tutorial/05-governed-composition)
3. [Tutorial 06: Sealed History and Review Flow](/tutorial/06-governed-sealing-and-history)
4. [@manifesto-ai/lineage](/api/lineage) and [@manifesto-ai/governance](/api/governance) only when you need package-level detail
5. [@manifesto-ai/planner](/api/planner) only when you already have governance and need read-only `preview()` / `plan()` foresight

## Do Not Start With These

| Section | Why It Feels Overwhelming |
|---------|---------------------------|
| [Concepts](/concepts/) | It is reference vocabulary, not a first-run guide |
| [Architecture](/architecture/) | It assumes the runtime path already feels concrete |
| [API Reference](/api/) | It is lookup-oriented and too flat for onboarding |
| [Internals](/internals/) | It is contributor and deep-dive material |

## When To Escalate

- Go to [Concepts](/concepts/) when a term like Snapshot, Intent, Flow, or World is still fuzzy.
- Go to [Architecture](/architecture/) when you understand the APIs but need the layer model.
- Go to [Internals](/internals/) only when you are changing Manifesto itself or auditing historical decisions.
