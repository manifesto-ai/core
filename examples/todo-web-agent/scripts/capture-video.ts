import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CdpResponse = Readonly<Record<string, unknown>>;
type PendingCommand = {
  readonly resolve: (value: CdpResponse) => void;
  readonly reject: (error: Error) => void;
};

const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_DIR = path.join(PACKAGE_ROOT, "public");
const FRAME_DIR = path.join(os.tmpdir(), `manifesto-agent-demo-frames-${process.pid}`);
const PROFILE_DIR = path.join(os.tmpdir(), `manifesto-agent-demo-chrome-${process.pid}`);

const BASE_URL = process.env.DEMO_URL ?? "http://127.0.0.1:5178";
const CHROME_BIN = process.env.CHROME_BIN ?? "google-chrome";
const FFMPEG_BIN = process.env.FFMPEG_BIN ?? "ffmpeg";
const WIDTH = numberFromEnv("CAPTURE_WIDTH", 1920);
const HEIGHT = numberFromEnv("CAPTURE_HEIGHT", 1080);
const FPS = numberFromEnv("CAPTURE_FPS", 8);
const ACTION_SECONDS = numberFromEnv("CAPTURE_ACTION_SECONDS", 8);
const TOTAL_SECONDS = numberFromEnv("CAPTURE_TOTAL_SECONDS", 30);

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureServer(): Promise<void> {
  const response = await fetch(`${BASE_URL}/?capture=1&frame=final`, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`capture server returned ${response.status} for ${BASE_URL}`);
  }
}

async function launchChrome(port: number): Promise<ChildProcessWithoutNullStreams> {
  const chrome = spawn(CHROME_BIN, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-crash-reporter",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${PROFILE_DIR}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "about:blank",
  ]);

  chrome.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`Chrome exited with code ${code}`);
    }
    if (signal) {
      console.error(`Chrome exited with signal ${signal}`);
    }
  });

  return chrome;
}

async function waitForPageSocket(port: number): Promise<string> {
  const listUrl = `http://127.0.0.1:${port}/json/list`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(listUrl);
      if (response.ok) {
        const targets = await response.json() as readonly {
          readonly type?: string;
          readonly webSocketDebuggerUrl?: string;
        }[];
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page?.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch {
      // Chrome is still starting.
    }

    await sleep(100);
  }

  throw new Error("Timed out waiting for Chrome DevTools page target");
}

async function createCdpClient(wsUrl: string) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map<number, PendingCommand>();
  const events = new Map<string, ((payload: CdpResponse) => void)[]>();
  let nextId = 0;

  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("Chrome DevTools socket failed")), { once: true });
  });

  ws.addEventListener("message", (event) => {
    const text = typeof event.data === "string"
      ? event.data
      : Buffer.from(event.data as ArrayBuffer).toString("utf8");
    const message = JSON.parse(text) as {
      readonly id?: number;
      readonly method?: string;
      readonly result?: CdpResponse;
      readonly params?: CdpResponse;
      readonly error?: { readonly message?: string };
    };

    if (message.id !== undefined) {
      const command = pending.get(message.id);
      if (!command) {
        return;
      }

      pending.delete(message.id);
      if (message.error) {
        command.reject(new Error(message.error.message ?? "Chrome DevTools command failed"));
      } else {
        command.resolve(message.result ?? {});
      }
      return;
    }

    if (message.method) {
      const listeners = events.get(message.method) ?? [];
      for (const listener of listeners) {
        listener(message.params ?? {});
      }
    }
  });

  function send(method: string, params: CdpResponse = {}): Promise<CdpResponse> {
    nextId += 1;
    const id = nextId;
    ws.send(JSON.stringify({ id, method, params }));

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  }

  function waitForEvent(method: string, timeoutMs = 10_000): Promise<CdpResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);

      const listener = (payload: CdpResponse) => {
        clearTimeout(timer);
        const listeners = events.get(method) ?? [];
        events.set(method, listeners.filter((item) => item !== listener));
        resolve(payload);
      };

      events.set(method, [...(events.get(method) ?? []), listener]);
    });
  }

  return {
    send,
    waitForEvent,
    close: () => ws.close(),
  };
}

function framePath(index: number): string {
  return path.join(FRAME_DIR, `frame_${String(index).padStart(4, "0")}.png`);
}

async function captureScreenshot(
  send: (method: string, params?: CdpResponse) => Promise<CdpResponse>,
  filePath: string,
): Promise<void> {
  const result = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const data = result.data;

  if (typeof data !== "string") {
    throw new Error("Chrome did not return screenshot data");
  }

  await fs.writeFile(filePath, data, "base64");
}

async function waitForFinished(send: (method: string, params?: CdpResponse) => Promise<CdpResponse>): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await send("Runtime.evaluate", {
      expression: "document.documentElement.dataset.manifestoDemo",
      returnByValue: true,
    });
    const value = (result.result as { readonly value?: unknown } | undefined)?.value;
    if (value === "finished") {
      return;
    }
    await sleep(150);
  }

  throw new Error("Timed out waiting for the demo to reach the finished marker");
}

async function waitForReady(send: (method: string, params?: CdpResponse) => Promise<CdpResponse>): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await send("Runtime.evaluate", {
      expression: "({ href: window.location.href, readyState: document.readyState })",
      returnByValue: true,
    });
    const value = (result.result as {
      readonly value?: { readonly href?: unknown; readonly readyState?: unknown };
    } | undefined)?.value;

    if (typeof value?.href === "string" && value.href.startsWith(BASE_URL) && value.readyState === "complete") {
      return;
    }

    await sleep(100);
  }

  throw new Error("Timed out waiting for the capture page to load");
}

async function runProcess(command: string, args: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function fileSize(filePath: string): Promise<string> {
  const stat = await fs.stat(filePath);
  const mb = stat.size / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

await ensureServer();
await fs.rm(FRAME_DIR, { recursive: true, force: true });
await fs.rm(PROFILE_DIR, { recursive: true, force: true });
await fs.mkdir(FRAME_DIR, { recursive: true });
await fs.mkdir(PUBLIC_DIR, { recursive: true });

const port = 19_200 + (process.pid % 1_000);
const chrome = await launchChrome(port);

try {
  const wsUrl = await waitForPageSocket(port);
  const cdp = await createCdpClient(wsUrl);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send("Page.navigate", {
    url: `${BASE_URL}/?capture=1&autoplay=1&speed=0.75`,
  });
  await waitForReady(cdp.send);
  await sleep(300);

  const actionFrames = Math.max(1, Math.round(ACTION_SECONDS * FPS));
  const totalFrames = Math.max(actionFrames, Math.round(TOTAL_SECONDS * FPS));
  let frameIndex = 0;

  for (; frameIndex < actionFrames; frameIndex += 1) {
    await captureScreenshot(cdp.send, framePath(frameIndex));
    await sleep(1000 / FPS);
  }

  await waitForFinished(cdp.send);

  const finalFrame = framePath(frameIndex);
  await captureScreenshot(cdp.send, finalFrame);
  frameIndex += 1;

  for (; frameIndex < totalFrames; frameIndex += 1) {
    await fs.copyFile(finalFrame, framePath(frameIndex));
  }

  cdp.close();
} finally {
  chrome.kill("SIGTERM");
}

const mp4Path = path.join(PUBLIC_DIR, "manifesto-agent-demo.mp4");
const gifPath = path.join(PUBLIC_DIR, "manifesto-agent-demo.gif");
const palettePath = path.join(FRAME_DIR, "palette.png");

await runProcess(FFMPEG_BIN, [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-framerate",
  String(FPS),
  "-i",
  path.join(FRAME_DIR, "frame_%04d.png"),
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  mp4Path,
]);

await runProcess(FFMPEG_BIN, [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  mp4Path,
  "-vf",
  "fps=8,scale=960:-1:flags=lanczos,palettegen",
  palettePath,
]);

await runProcess(FFMPEG_BIN, [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  mp4Path,
  "-i",
  palettePath,
  "-lavfi",
  "fps=8,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4",
  gifPath,
]);

await fs.rm(FRAME_DIR, { recursive: true, force: true });
await fs.rm(PROFILE_DIR, { recursive: true, force: true });

console.log(JSON.stringify({
  status: "ok",
  url: `${BASE_URL}/?capture=1&autoplay=1&speed=0.75`,
  fps: FPS,
  seconds: TOTAL_SECONDS,
  mp4: {
    path: path.relative(PACKAGE_ROOT, mp4Path),
    size: await fileSize(mp4Path),
  },
  gif: {
    path: path.relative(PACKAGE_ROOT, gifPath),
    size: await fileSize(gifPath),
  },
}, null, 2));
