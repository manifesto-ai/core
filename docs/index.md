---
layout: home

hero:
  name: Manifesto
  text: Semantic Layer for Deterministic Domain State
  tagline: Define meaning once, then ship runtime, editor, agent, and inspection surfaces from the same MEL schema.
  actions:
    - theme: brand
      text: Start Here
      link: /start-here
    - theme: alt
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: Developer Tooling
      link: /guides/developer-tooling

features:
  - icon: 🎯
    title: Deterministic
    details: Same input -> same output. Always.
  - icon: 🧭
    title: Expandable
    details: Start small, then add approval and sealed history only when the project actually needs them.
  - icon: 📐
    title: Schema-First
    details: MEL and DomainSchema stay at the center of every surface.
  - icon: 🛠️
    title: Toolable
    details: CLI, LSP, Studio, and agent tooling all derive from the same model.
  - icon: ⚡
    title: Effect Isolation
    details: Pure computation stays separate from IO.
---

## Pick One Route

Do not start by browsing every section.

| If You Want | Read This First | Then Go Here |
|-------------|-----------------|--------------|
| Ship the first working app | [Start Here](/start-here) | [Quickstart](/quickstart) -> [Tutorial](/tutorial/) |
| Set up CLI, editor, agent, or Studio workflows | [Developer Tooling](/guides/developer-tooling) | [API Reference](/api/) |
| Add review, approval, or audit history | [When You Need Approval or History](/guides/approval-and-history) | [Tutorial](/tutorial/) |
| Look up a package surface you already know you need | [API Reference](/api/) | package page |

If you are new, leave [Architecture](/architecture/) and [Internals](/internals/) for later.

## Start With The Base Runtime

Manifesto's default path is the base runtime. Most teams should start there and stay there until the project needs review flows or sealed history.

| Path | Package | When to use |
|------|---------|-------------|
| **Base runtime** | `@manifesto-ai/sdk` | You want the shortest path to a working app |
| **Advanced runtime** | `@manifesto-ai/lineage` + `@manifesto-ai/governance` | You need approval, audit history, branch continuity, or sealing |

When that later-stage need shows up, use [When You Need Approval or History](/guides/approval-and-history) first instead of jumping straight into the package APIs.

## Developer Surfaces

Manifesto's current public surface is not just the runtime packages.

| Need | Package | What You Get |
|------|---------|--------------|
| **Bootstrap or retrofit a repo** | [`@manifesto-ai/cli`](/api/cli) | `init`, `integrate`, `setup`, `doctor`, `scaffold` |
| **Author MEL with editor support** | [`@manifesto-ai/mel-lsp`](/api/mel-lsp) | diagnostics, completion, hover, rename, schema introspection |
| **Load Manifesto guidance into AI tools** | [`@manifesto-ai/skills`](/api/skills) | explicit Codex, Claude Code, Cursor, Copilot, and Windsurf installers |
| **Inspect a domain from the terminal** | [`@manifesto-ai/studio-cli`](/api/studio-cli) | findings, graph, snapshot, trace, lineage, governance, transition graphs |
| **Build analysis tooling or agent endpoints** | [`@manifesto-ai/studio-core`](/api/studio-core) + [`@manifesto-ai/studio-mcp`](/api/studio-mcp) | projection-first analysis APIs and MCP transport |

## Quick Example

```mel
domain Counter {
  state { count: number = 0 }
  action increment() {
    onceIntent { patch count = add(count, 1) }
  }
}
```

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterSchema from "./counter.mel";

const app = createManifesto(CounterSchema, {}).activate();
await app.dispatchAsync(app.createIntent(app.MEL.actions.increment));
console.log(app.getSnapshot().data.count); // 1
```

## Start Here

| Step | Link | Time |
|------|------|------|
| **Choose a reading path** | [Start Here](/start-here) | 3 min |
| **Install and run** | [Quickstart](/quickstart) | 5 min |
| **Set up DX surfaces** | [Developer Tooling](/guides/developer-tooling) | 10 min |
| **Escalate to approval or history later** | [When You Need Approval or History](/guides/approval-and-history) | 10 min |
| **Use reference pages only when needed** | [API Reference](/api/) | Browse |

## Installation

```bash
npm install @manifesto-ai/sdk @manifesto-ai/compiler
```

Add `@manifesto-ai/lineage` and `@manifesto-ai/governance` only later, when the project needs approval, audit history, or sealed continuity on top of the same base runtime.

Optional DX packages live on top of that runtime surface:

| Need | Package |
|------|---------|
| Bootstrap/configuration | `@manifesto-ai/cli` |
| Editor and schema introspection | `@manifesto-ai/mel-lsp` |
| AI coding tool guidance | `@manifesto-ai/skills` |
| Terminal inspection | `@manifesto-ai/studio-cli` |
| Programmatic and MCP inspection | `@manifesto-ai/studio-core`, `@manifesto-ai/studio-mcp` |

## Go Deeper

- [Architecture](/architecture/) - system design and boundaries
- [Guides](/guides/) - practical workflows
- [Developer Tooling](/guides/developer-tooling) - CLI, editor, Studio, and agent setup
- [API Reference](/api/) - package-level API docs
- [Internals](/internals/) - ADRs, SPECs, FDRs
