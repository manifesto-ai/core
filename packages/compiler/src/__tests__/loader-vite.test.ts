import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import melWebpackLoader, { load, resolve } from "../loader.js";
import { melPlugin } from "../vite.js";

const VALID_MEL = `
domain Counter {
  state { count: number = 0 }
  action increment() {
    onceIntent { patch count = add(count, 1) }
  }
}
`.trim();

async function importFromModuleCode(code: string): Promise<{ default: unknown }> {
  const encoded = Buffer.from(code, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

describe("melPlugin()", () => {
  it("transforms .mel source into an ESM module", async () => {
    const plugin = melPlugin();
    const transformed = plugin.transform(VALID_MEL, "/tmp/counter.mel");

    expect(transformed).not.toBeNull();
    if (!transformed) return;

    const module = await importFromModuleCode(transformed.code);
    const schema = module.default as { actions?: Record<string, unknown> };

    expect(schema.actions).toHaveProperty("increment");
  });

  it("returns null for non-.mel modules", () => {
    const plugin = melPlugin();
    const transformed = plugin.transform("export const x = 1;", "/tmp/main.ts");
    expect(transformed).toBeNull();
  });

  it("throws when MEL compilation fails", () => {
    const plugin = melPlugin();
    expect(() => plugin.transform("domain Broken {", "/tmp/broken.mel")).toThrow(
      "MEL compilation failed"
    );
  });
});

describe("loader default export (webpack)", () => {
  it("compiles MEL source through webpack loader contract", async () => {
    const cacheable = vi.fn();
    const output = melWebpackLoader.call(
      { resourcePath: "/tmp/counter.mel", cacheable },
      VALID_MEL
    );

    expect(cacheable).toHaveBeenCalledWith(true);

    const module = await importFromModuleCode(output);
    const schema = module.default as { actions?: Record<string, unknown> };
    expect(schema.actions).toHaveProperty("increment");
  });
});

describe("loader.cjs wrapper", () => {
  it("supports CJS require for webpack loader resolution", async () => {
    const require = createRequire(import.meta.url);
    const cjsLoader = require("../../loader.cjs") as (
      this: {
        resourcePath?: string;
        cacheable?: (cacheable?: boolean) => void;
        async: () => (error: unknown, output?: string) => void;
      },
      source: string
    ) => void;

    const cacheable = vi.fn();
    const output = await new Promise<string>((resolve, reject) => {
      const context = {
        resourcePath: "/tmp/counter.mel",
        cacheable,
        async: () => (error: unknown, result?: string) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(result ?? "");
        },
      };

      cjsLoader.call(context, VALID_MEL);
    });

    expect(cacheable).toHaveBeenCalledWith(true);

    const module = await importFromModuleCode(output);
    const schema = module.default as { actions?: Record<string, unknown> };
    expect(schema.actions).toHaveProperty("increment");
  });
});

describe("loader resolve/load hooks (node --loader)", () => {
  it("short-circuits .mel resolution", async () => {
    const nextResolve = vi.fn(async () => ({
      url: "file:///tmp/counter.mel",
    }));

    const resolved = await resolve(
      "./counter.mel",
      { parentURL: "file:///tmp/main.ts" },
      nextResolve
    );

    expect(nextResolve).toHaveBeenCalledTimes(1);
    expect(resolved.url).toBe("file:///tmp/counter.mel");
    expect(resolved.shortCircuit).toBe(true);
  });

  it("passes through non-.mel resolution", async () => {
    const nextResolve = vi.fn(async () => ({
      url: "file:///tmp/main.ts",
    }));

    const resolved = await resolve("./main.ts", { parentURL: "file:///tmp/app.ts" }, nextResolve);

    expect(nextResolve).toHaveBeenCalledTimes(1);
    expect(resolved.url).toBe("file:///tmp/main.ts");
    expect(resolved.shortCircuit).toBeUndefined();
  });

  it("loads and compiles .mel files from file URL", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "manifesto-mel-loader-"));

    try {
      const melPath = join(tempDir, "counter.mel");
      await writeFile(melPath, VALID_MEL, "utf8");

      const nextLoad = vi.fn(async () => ({
        format: "module",
        source: "",
      }));

      const result = await load(pathToFileURL(melPath).href, {}, nextLoad);
      expect(nextLoad).not.toHaveBeenCalled();
      expect(result.format).toBe("module");
      expect(result.shortCircuit).toBe(true);
      expect(typeof result.source).toBe("string");

      const module = await importFromModuleCode(result.source as string);
      const schema = module.default as { actions?: Record<string, unknown> };
      expect(schema.actions).toHaveProperty("increment");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("passes through non-.mel loads", async () => {
    const nextLoad = vi.fn(async () => ({
      format: "module",
      source: "export default 1;",
    }));

    const loaded = await load("file:///tmp/main.ts", {}, nextLoad);

    expect(nextLoad).toHaveBeenCalledTimes(1);
    expect(loaded.format).toBe("module");
    expect(loaded.source).toBe("export default 1;");
    expect(loaded.shortCircuit).toBeUndefined();
  });
});
