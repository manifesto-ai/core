import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { unpluginMel } from "../unplugin.js";
import { melPlugin } from "../vite.js";
import { melPlugin as webpackPlugin } from "../webpack.js";
import { load, resolve } from "../node-loader.js";

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

describe("unplugin core", () => {
  it("transforms .mel source into an ESM module", async () => {
    const plugin = unpluginMel.raw({});
    const result = plugin.transform(VALID_MEL, "/tmp/counter.mel");
    expect(result).toBeDefined();

    const code = typeof result === "string" ? result : result?.code;
    expect(code).toBeDefined();

    const module = await importFromModuleCode(code!);
    const schema = module.default as { actions?: Record<string, unknown> };
    expect(schema.actions).toHaveProperty("increment");
  });

  it("filters out non-.mel files via transformInclude", () => {
    const plugin = unpluginMel.raw({});
    expect(plugin.transformInclude("/tmp/counter.mel")).toBe(true);
    expect(plugin.transformInclude("/tmp/main.ts")).toBe(false);
  });

  it("throws when MEL compilation fails", () => {
    const plugin = unpluginMel.raw({});
    expect(() => plugin.transform("domain Broken {", "/tmp/broken.mel")).toThrow(
      "MEL compilation failed"
    );
  });

  it("strips query params from id", () => {
    const plugin = unpluginMel.raw({});
    expect(plugin.transformInclude("/tmp/counter.mel?v=123")).toBe(true);
  });

  it("supports custom include regex", () => {
    const plugin = unpluginMel.raw({ include: /\.manifesto$/ });
    expect(plugin.transformInclude("/tmp/counter.manifesto")).toBe(true);
    expect(plugin.transformInclude("/tmp/counter.mel")).toBe(false);
  });

  it("emits compiled schemas through an injected codegen handler", async () => {
    const emit = vi.fn(async () => {});
    const plugin = unpluginMel.raw({ codegen: emit });
    const sourcePath = join(process.cwd(), "src/domain/counter.mel");

    plugin.transform(VALID_MEL, sourcePath);
    await plugin.buildEnd?.call(plugin);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "src/domain/counter.mel",
        schema: expect.objectContaining({
          actions: expect.objectContaining({
            increment: expect.any(Object),
          }),
        }),
      })
    );
  });

  it("keeps external absolute source IDs collision-free for codegen", async () => {
    const emit = vi.fn(async () => {});
    const plugin = unpluginMel.raw({ codegen: emit });

    plugin.transform(VALID_MEL, "/tmp/workspace-a/domain/counter.mel");
    plugin.transform(VALID_MEL, "/var/tmp/workspace-b/domain/counter.mel");
    await plugin.buildEnd?.call(plugin);

    expect(emit).toHaveBeenCalledTimes(2);

    const sourceIds = emit.mock.calls.map(([artifact]) => artifact.sourceId);
    expect(new Set(sourceIds).size).toBe(2);
    for (const sourceId of sourceIds) {
      expect(sourceId).toMatch(/^external\/counter--[a-f0-9]{12}\.mel$/);
    }
  });

  it("rejects codegen config objects without a callable emit function", () => {
    const invalidCodegen: unknown = { outDir: "." };

    expect(() =>
      unpluginMel.raw({
        codegen: invalidCodegen as never,
      })
    ).toThrow(
      "manifesto:mel codegen must be a function or an object with a callable emit field"
    );
  });
});

describe("vite export", () => {
  it("exports a function that returns a Vite plugin", () => {
    expect(typeof melPlugin).toBe("function");
    const plugin = melPlugin();
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("manifesto:mel");
  });
});

describe("webpack export", () => {
  it("exports a function that returns a Webpack plugin", () => {
    expect(typeof webpackPlugin).toBe("function");
    const plugin = webpackPlugin();
    expect(plugin).toBeDefined();
  });
});

describe("node-loader resolve/load hooks", () => {
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
