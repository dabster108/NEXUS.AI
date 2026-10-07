import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Reads eval-harness run envelopes (`nexus-evals/v1`) straight off disk.
 *
 * Server-only: this is the one place the frontend touches the filesystem, and
 * it only ever reads the harness's own artifact directory. The harness is an
 * external client of the backend, so its results never pass through the
 * backend either — the page shows exactly the files the CLI wrote.
 *
 * Override the location with NEXUS_EVALS_RESULTS_DIR.
 */

const SCHEMA = "nexus-evals/v1";

export function resultsDir() {
  return (
    process.env.NEXUS_EVALS_RESULTS_DIR ||
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", "evals", "results")
  );
}

/**
 * Envelopes written before per-case summaries existed still carry per-trial
 * `cases[]`, so the summary can be rebuilt with the harness's own rule:
 * a case passes only when every one of its trials passed.
 */
function deriveSummary(cases) {
  const grouped = new Map();
  for (const c of cases) {
    if (!grouped.has(c.case_id)) grouped.set(c.case_id, []);
    grouped.get(c.case_id).push(c);
  }
  return [...grouped.entries()].map(([caseId, trials]) => {
    const passes = trials.filter((t) => t.passed).length;
    const latencies = trials.map((t) => Number(t.latency_ms) || 0).sort((a, b) => a - b);
    return {
      case_id: caseId,
      trials: trials.length,
      passed_trials: passes,
      pass_rate: passes / trials.length,
      passed: passes === trials.length,
      flaky: passes > 0 && passes < trials.length,
      quality_avg:
        trials.reduce((sum, t) => sum + (Number(t.quality_avg) || 0), 0) / trials.length,
      latency_p50_ms: latencies[Math.max(0, Math.round(latencies.length / 2) - 1)] ?? 0,
      latency_max_ms: latencies.at(-1) ?? 0,
    };
  });
}

function normalize(raw, file) {
  const cases = Array.isArray(raw.cases) ? raw.cases : [];
  const summary =
    Array.isArray(raw.case_summary) && raw.case_summary.length
      ? raw.case_summary
      : deriveSummary(cases);
  const started = Date.parse(raw.started_at ?? "");
  const finished = Date.parse(raw.finished_at ?? "");
  return {
    ...raw,
    file,
    cases,
    case_summary: summary,
    case_count: raw.case_count ?? summary.length,
    passed: raw.passed ?? summary.filter((s) => s.passed).length,
    failed: raw.failed ?? summary.filter((s) => !s.passed).length,
    repeat: raw.repeat ?? 1,
    flaky: raw.flaky ?? summary.filter((s) => s.flaky).length,
    aggregates: raw.aggregates ?? {},
    duration_ms:
      Number.isFinite(started) && Number.isFinite(finished) ? finished - started : null,
    started_ms: Number.isFinite(started) ? started : 0,
  };
}

/**
 * Every readable run, newest first. `legacy` counts pre-envelope list files,
 * which are skipped rather than guessed at. The `<dataset>.json` alias repeats
 * a run already on disk, so duplicates collapse to the named file.
 */
export async function loadRuns() {
  const dir = resultsDir();
  let names;
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith(".json"));
  } catch {
    return { dir, runs: [], legacy: 0, missing: true };
  }

  let legacy = 0;
  const byKey = new Map();
  for (const name of names) {
    let raw;
    try {
      raw = JSON.parse(await readFile(path.join(/*turbopackIgnore: true*/ dir, name), "utf8"));
    } catch {
      continue;
    }
    if (Array.isArray(raw)) {
      legacy += 1;
      continue;
    }
    if (!raw || raw.schema !== SCHEMA) continue;

    const run = normalize(raw, name);
    const key = `${run.run_name}@${run.started_at}`;
    const existing = byKey.get(key);
    // Prefer `<run_name>.json` over the alias that duplicates it.
    if (!existing || name === `${run.run_name}.json`) byKey.set(key, run);
  }

  const runs = [...byKey.values()].sort((a, b) => b.started_ms - a.started_ms);
  return { dir, runs, legacy, missing: false };
}
