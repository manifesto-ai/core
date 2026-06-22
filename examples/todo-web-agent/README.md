# Manifesto Todo Web Agent Demo

> Runnable capture surface for the 30-second Manifesto agent-state demo.

This example is built for the public launch asset:

```text
React Todo UI + scripted agent panel + Snapshot/action log
```

The agent path is scripted on purpose. It does not call a live LLM provider, so
the demo can be recorded deterministically and run without API keys. The script
still calls the same app-owned action functions that a real agent tool adapter
would call.

## Run It

From the repository root:

```bash
pnpm install
pnpm --filter @manifesto-ai/example-todo-web-agent dev
```

Open the Vite URL and press **Play**. The timeline shows:

1. the agent receives `Clean up my todo list.`
2. the agent reads the current Todo view
3. the app exposes `inspect.availableActions()`
4. the agent calls typed app-owned actions
5. the Todo UI and Snapshot log update from the same Manifesto runtime

## Recording Mode

For a stable 1920x1080 capture surface, run:

```bash
pnpm --filter @manifesto-ai/example-todo-web-agent dev:capture
```

Then open:

```text
http://127.0.0.1:5178/?capture=1&autoplay=1
```

Useful query parameters:

| Parameter | Effect |
|-----------|--------|
| `capture=1` | Uses a wider, fixed recording layout and hides manual controls |
| `autoplay=1` | Starts the scripted agent after load |
| `frame=final` | Renders the final poster/still frame without waiting for playback |
| `speed=0.75` | Multiplies timeline waits; lower values play faster |

For a still frame or README poster, use:

```text
http://127.0.0.1:5178/?capture=1&frame=final
```

The checked-in poster asset is generated from that frame:

```text
public/manifesto-agent-demo-poster.png
```

To generate a 30-second local MP4/GIF capture, keep the capture server running
and run:

```bash
pnpm --filter @manifesto-ai/example-todo-web-agent capture:video
```

The video script uses Chrome headless through the DevTools protocol and writes:

```text
public/manifesto-agent-demo.mp4
public/manifesto-agent-demo.gif
```

## Check It

```bash
pnpm --filter @manifesto-ai/example-todo-web-agent typecheck
pnpm --filter @manifesto-ai/example-todo-web-agent build
pnpm --filter @manifesto-ai/example-todo-web-agent capture:smoke
```

## File Map

| File | Purpose |
|------|---------|
| `src/domain/todo.mel` | Todo domain state, computed values, and actions |
| `src/runtime/manifesto-app.ts` | Runtime activation and shared Todo view |
| `src/runtime/todo-actions.ts` | App-owned write functions |
| `src/runtime/scripted-agent.ts` | Deterministic agent playback steps |
| `scripts/capture-smoke.ts` | Verifies the final frame without browser automation |
| `scripts/capture-video.ts` | Captures a 30-second MP4/GIF through Chrome CDP and ffmpeg |
| `src/hooks/use-agent-demo.ts` | React state bridge for playback |
| `src/app.tsx` | Three-panel recording surface |

Use this as the first implementation slice before embedding a GIF or MP4 in
the main README.
