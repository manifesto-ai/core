import { useCallback, useEffect, useRef, useState } from "react";

import { createTodoRuntime, readTodoView } from "../runtime/manifesto-app";
import {
  createReadLog,
  SCRIPTED_AGENT_FINAL_FRAME,
  SCRIPTED_AGENT_STEPS,
  type DemoCaption,
} from "../runtime/scripted-agent";
import type { AgentLogEntry, TodoApp, TodoView, TodoWriteResponse } from "../types";

type DemoStatus = "ready" | "playing" | "finished";

export type DemoMode = {
  readonly autoplay: boolean;
  readonly capture: boolean;
  readonly frame: "live" | "final";
  readonly playbackScale: number;
};

type UseAgentDemoResult = {
  readonly view: TodoView;
  readonly caption: DemoCaption;
  readonly status: DemoStatus;
  readonly mode: DemoMode;
  readonly log: readonly AgentLogEntry[];
  readonly lastResponse: TodoWriteResponse | null;
  readonly highlightTodoId: string | null;
  readonly play: () => Promise<void>;
  readonly reset: () => void;
};

const CAPTION_COPY: Record<DemoCaption, string> = {
  idle: "Prompt text is not a contract.",
  prompt: "Your agent wants to change app state.",
  read: "The agent reads the current Snapshot.",
  available: "Manifesto exposes legal typed actions.",
  write: "The agent calls app-owned actions.",
  settled: "UI and agent share one runtime state.",
  done: "Star it if you want safer agent writes.",
};

export function captionFor(caption: DemoCaption): string {
  return CAPTION_COPY[caption];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseDemoMode(): DemoMode {
  const params = new URLSearchParams(window.location.search);
  const speed = Number(params.get("speed"));

  return {
    autoplay: params.get("autoplay") === "1",
    capture: params.get("capture") === "1",
    frame: params.get("frame") === "final" || params.get("poster") === "1" ? "final" : "live",
    playbackScale: Number.isFinite(speed) && speed > 0 ? Math.min(speed, 3) : 1,
  };
}

export function useAgentDemo(): UseAgentDemoResult {
  const runtimeRef = useRef<TodoApp>(createTodoRuntime());
  const modeRef = useRef<DemoMode>(parseDemoMode());
  const initialFrame = modeRef.current.frame === "final" ? SCRIPTED_AGENT_FINAL_FRAME : null;
  const logIdRef = useRef(0);
  const playTokenRef = useRef(0);
  const autoplayStartedRef = useRef(false);
  const [view, setView] = useState<TodoView>(() => initialFrame?.view ?? readTodoView(runtimeRef.current));
  const [caption, setCaption] = useState<DemoCaption>(initialFrame ? "done" : "idle");
  const [status, setStatus] = useState<DemoStatus>(initialFrame ? "finished" : "ready");
  const [log, setLog] = useState<readonly AgentLogEntry[]>(initialFrame?.entries ?? []);
  const [lastResponse, setLastResponse] = useState<TodoWriteResponse | null>(initialFrame?.latestResponse ?? null);
  const [highlightTodoId, setHighlightTodoId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.manifestoDemo = modeRef.current.frame === "final" ? "finished" : "ready";

    return () => runtimeRef.current.dispose();
  }, []);

  const nextLogId = useCallback(() => {
    logIdRef.current += 1;
    return logIdRef.current;
  }, []);

  const pushLog = useCallback((entry: Omit<AgentLogEntry, "id">) => {
    const next = { ...entry, id: nextLogId() };
    setLog((current) => [...current, next].slice(-8));
  }, [nextLogId]);

  const reset = useCallback(() => {
    playTokenRef.current += 1;
    runtimeRef.current.dispose();
    runtimeRef.current = createTodoRuntime();
    logIdRef.current = 0;
    document.documentElement.dataset.manifestoDemo = "ready";
    setView(readTodoView(runtimeRef.current));
    setCaption("idle");
    setStatus("ready");
    setLog([]);
    setLastResponse(null);
    setHighlightTodoId(null);
  }, []);

  const play = useCallback(async () => {
    if (status === "playing") {
      return;
    }

    const token = playTokenRef.current + 1;
    playTokenRef.current = token;
    runtimeRef.current.dispose();
    runtimeRef.current = createTodoRuntime();
    logIdRef.current = 0;
    document.documentElement.dataset.manifestoDemo = "playing";
    setView(readTodoView(runtimeRef.current));
    setCaption("prompt");
    setStatus("playing");
    setLog([]);
    setLastResponse(null);
    setHighlightTodoId(null);

    for (const step of SCRIPTED_AGENT_STEPS) {
      if (playTokenRef.current !== token) {
        return;
      }

      setCaption(step.caption);

      if (step.kind === "log") {
        pushLog({
          at: step.caption,
          label: step.label,
          detail: step.detail,
          tone: step.tone,
        });
      } else if (step.kind === "read") {
        setView(readTodoView(runtimeRef.current));
        setLog((current) => [...current, createReadLog(nextLogId(), runtimeRef.current)].slice(-8));
      } else {
        setHighlightTodoId(step.highlightTodoId ?? null);
        pushLog({
          at: "tool",
          label: step.label,
          detail: step.detail,
          tone: "neutral",
        });
        const response = await step.run(runtimeRef.current);
        setLastResponse(response);
        setView(response.view);
        pushLog({
          at: "result",
          label: response.action,
          detail: response.status === "settled" ? "outcome: ok" : response.status,
          tone: response.status === "settled" ? "ok" : "warn",
        });
      }

      const waitMs = Math.round(step.waitMs * modeRef.current.playbackScale);
      if (waitMs > 0) {
        await wait(waitMs);
      }
    }

    if (playTokenRef.current === token) {
      setHighlightTodoId(null);
      setStatus("finished");
      document.documentElement.dataset.manifestoDemo = "finished";
    }
  }, [nextLogId, pushLog, status]);

  useEffect(() => {
    if (modeRef.current.frame === "final") {
      return;
    }

    if (!modeRef.current.autoplay || autoplayStartedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (autoplayStartedRef.current) {
        return;
      }

      autoplayStartedRef.current = true;
      void play();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [play]);

  return {
    view,
    caption,
    status,
    mode: modeRef.current,
    log,
    lastResponse,
    highlightTodoId,
    play,
    reset,
  };
}
