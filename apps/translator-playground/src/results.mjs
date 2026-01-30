import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "case";
}

function defaultRunId() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${timestamp}_${suffix}`;
}

export function serializeDiagnostics(diagnostics) {
  return {
    warnings: diagnostics.warnings,
    infos: diagnostics.infos,
    metrics: Object.fromEntries(diagnostics.metrics ?? []),
    metricObservations: Object.fromEntries(
      [...(diagnostics.metricObservations ?? [])].map(([key, value]) => [
        key,
        [...value],
      ])
    ),
  };
}

export function createRunContext(options = {}) {
  const baseDir =
    options.baseDir ??
    process.env.MANIFESTO_RESULTS_DIR ??
    path.resolve(process.cwd(), "results");
  const runId =
    options.runId ?? process.env.MANIFESTO_RESULTS_RUN_ID ?? defaultRunId();
  const label = options.label ?? process.env.MANIFESTO_RESULTS_LABEL ?? "run";
  const startedAt = new Date().toISOString();

  const runDir = path.join(baseDir, runId);
  const casesDir = path.join(runDir, "cases");
  ensureDir(casesDir);

  const manifest = {
    runId,
    label,
    startedAt,
    model: options.model ?? null,
    pipelineOptions: options.pipelineOptions ?? null,
    cases: [],
  };

  function writeManifest(extra = {}) {
    const payload = { ...manifest, ...extra, updatedAt: new Date().toISOString() };
    fs.writeFileSync(
      path.join(runDir, "manifest.json"),
      JSON.stringify(payload, null, 2)
    );
  }

  function writeCase(caseId, payload) {
    const safeId = sanitizeId(caseId);
    const fileName = `${safeId}.json`;
    const filePath = path.join(casesDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

    manifest.cases.push({
      id: caseId,
      file: path.join("cases", fileName),
      status: payload.status ?? "ok",
    });

    writeManifest();
    return filePath;
  }

  function finalize(extra = {}) {
    manifest.completedAt = new Date().toISOString();
    writeManifest(extra);
  }

  writeManifest();

  return {
    runId,
    runDir,
    casesDir,
    writeCase,
    finalize,
    manifest,
  };
}
