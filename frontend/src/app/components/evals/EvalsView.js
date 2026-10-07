import Link from "next/link";
import { relativeTime } from "@/lib/format";
import { Sparkline } from "../ui/primitives";

/**
 * Eval runs, as the harness wrote them (the body of /dashboard/evals).
 *
 * A read-only projection of `evals/results/*.json`: the same envelopes the
 * CLI prints and CI gates on, so this page can never disagree with the exit
 * code. It renders at request time because the files change under it every
 * time someone runs the harness.
 *
 * Entirely server-rendered — the trend's hover labels are CSS, and choosing a
 * run is a link, so the page ships no client JavaScript of its own.
 */

const QUALITY_ORDER = [
  "tool_selection",
  "event_contract",
  "outcome",
  "keywords",
  "completion",
  "safety",
];

const SCORE_LABELS = {
  tool_selection: "Tool selection",
  event_contract: "Event contract",
  outcome: "Outcome",
  keywords: "Keywords",
  completion: "Completion",
  safety: "Safety",
  latency: "Latency",
};

function pct(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function score(value) {
  return (Number(value) || 0).toFixed(2);
}

function duration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function Verdict({ passed, flaky }) {
  if (flaky) {
    return (
      <span className="chip chip-warn">
        <span aria-hidden>≈</span> Flaky
      </span>
    );
  }
  return passed ? (
    <span className="chip chip-ok">
      <span aria-hidden>✓</span> Passed
    </span>
  ) : (
    <span className="chip chip-danger">
      <span aria-hidden>✗</span> Failed
    </span>
  );
}

function Stat({ label, value, sub, hero = false, trend, tone }) {
  return (
    <div className="card section-card p-4">
      <p className="t-label">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p
          className={`font-semibold tracking-[-0.03em] text-[var(--ink)] ${
            hero ? "text-[2.25rem] leading-none" : "text-[1.5rem] leading-none"
          }`}
        >
          {value}
        </p>
        {trend && trend.length > 1 ? (
          <Sparkline values={trend} tone={tone} width={72} height={26} label={`${label} over the last ${trend.length} runs`} />
        ) : null}
      </div>
      {sub ? <p className="t-meta mt-2">{sub}</p> : null}
    </div>
  );
}

/** Overall quality per run, oldest → newest. One series, so no legend. */
function Trend({ runs, selected, base }) {
  const series = [...runs].slice(0, 24).reverse();
  return (
    <section className="card section-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-h2">Overall quality by run</h2>
        <span className="t-meta">last {series.length} · click a bar to open it</span>
      </div>
      <div className="relative mt-5 h-40 pl-8">
        {/* recessive hairline grid at clean ticks */}
        {[1, 0.5, 0].map((tick) => (
          <div
            key={tick}
            className="absolute inset-x-0 pl-8"
            style={{ bottom: `${tick * 100}%` }}
          >
            <span className="mono absolute left-0 -translate-y-1/2 text-[10.5px] tabular-nums text-[var(--ink-3)]">
              {tick.toFixed(1)}
            </span>
            <div className="h-px bg-[var(--line)]" />
          </div>
        ))}
        <div className="absolute inset-y-0 left-8 right-0 flex items-end gap-[2px]">
          {series.map((run) => {
            const value = Number(run.aggregates.overall) || 0;
            const isSelected = run === selected;
            return (
              <Link
                key={run.file}
                href={`${base}?run=${encodeURIComponent(run.run_name)}`}
                aria-label={`${run.run_name}: overall ${score(value)}, passed ${run.passed} of ${run.case_count}`}
                className="trend-col group relative flex h-full min-w-0 flex-1 items-end justify-center"
              >
                <span
                  className={`trend-bar block w-full max-w-[24px] rounded-t-[4px] ${
                    isSelected ? "bg-[var(--accent)]" : "bg-[var(--accent-line)]"
                  }`}
                  style={{ height: `${Math.max(value * 100, 1.5)}%` }}
                />
                {isSelected ? (
                  <span
                    className="mono absolute text-[10.5px] font-semibold tabular-nums text-[var(--ink)]"
                    style={{ bottom: `calc(${value * 100}% + 4px)` }}
                  >
                    {score(value)}
                  </span>
                ) : null}
                <span className="trend-tip pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[220px] rounded-[8px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-left shadow-[var(--shadow-md)]">
                  <span className="block truncate text-[11.5px] font-semibold">
                    {run.run_name}
                  </span>
                  <span className="mono block text-[10.5px] text-[var(--ink-2)]">
                    overall {score(value)} · {run.passed}/{run.case_count} passed
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Mean of each score for the selected run, as a magnitude bar. */
function Breakdown({ aggregates }) {
  const names = [
    ...QUALITY_ORDER.filter((n) => n in aggregates),
    ...Object.keys(aggregates).filter(
      (n) => !QUALITY_ORDER.includes(n) && n !== "overall" && n !== "latency",
    ),
  ];
  return (
    <section className="card section-card p-5">
      <h2 className="t-h2">Score breakdown</h2>
      <p className="t-meta mt-1">Mean per scorer. Overall averages the blue bars; latency is diagnostic only.</p>
      <div className="mt-4 space-y-3">
        {names.map((name) => (
          <ScoreRow key={name} label={SCORE_LABELS[name] ?? name} value={aggregates[name]} />
        ))}
        {"latency" in aggregates ? (
          <ScoreRow label="Latency" value={aggregates.latency} muted />
        ) : null}
      </div>
    </section>
  );
}

function ScoreRow({ label, value, muted = false }) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  return (
    <div className="grid grid-cols-[120px_1fr_40px] items-center gap-3">
      <span className="truncate text-[12.5px] text-[var(--ink-2)]">{label}</span>
      <span className="h-[10px] overflow-hidden rounded-r-[4px] bg-[var(--surface-3)]">
        <span
          className={`score-bar block h-full rounded-r-[4px] ${
            muted ? "bg-[var(--line-3)]" : "bg-[var(--accent)]"
          }`}
          style={{ width: `${v * 100}%` }}
        />
      </span>
      <span className="mono text-right text-[12px] tabular-nums text-[var(--ink)]">
        {score(v)}
      </span>
    </div>
  );
}

function Comparison({ comparison }) {
  const rows = [
    ["Regressions", comparison.regressions, "chip-danger"],
    ["Fixed", comparison.fixes, "chip-ok"],
    ["Still failing", comparison.still_failing, "chip-warn"],
    ["New cases", comparison.added, ""],
    ["Removed", comparison.removed, ""],
  ];
  const overall = comparison.aggregate_deltas?.overall;
  return (
    <section className="card section-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-h2">
          vs <span className="mono text-[0.95em]">{comparison.baseline_run}</span>
        </h2>
        {overall != null ? (
          <span className="mono text-[12px] tabular-nums text-[var(--ink-2)]">
            overall {overall > 0 ? "+" : ""}
            {overall.toFixed(2)}
          </span>
        ) : null}
      </div>
      <dl className="mt-3 space-y-2">
        {rows.map(([label, items, tone]) => (
          <div key={label} className="flex flex-wrap items-baseline gap-2">
            <dt className="w-[96px] flex-none text-[12.5px] text-[var(--ink-2)]">{label}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {items?.length ? (
                items.map((id) => (
                  <span key={id} className={`chip mono !text-[11px] ${tone}`}>
                    {id}
                  </span>
                ))
              ) : (
                <span className="t-meta">none</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CaseRow({ row, trials, index, history }) {
  return (
    <details
      className="case-row group border-b border-[var(--line)] last:border-b-0"
      style={{ "--i": index }}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] sm:grid-cols-[minmax(0,1.4fr)_90px_70px_80px_96px_100px]">
        <span className="flex min-w-0 items-center gap-2.5">
          <svg
            className="case-caret flex-none text-[var(--ink-3)]"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            aria-hidden
          >
            <path d="M3 1.5L6.5 5 3 8.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <span className="mono truncate text-[12.5px] font-medium">{row.case_id}</span>
        </span>
        <span className="sm:order-none">
          <Verdict passed={row.passed} flaky={row.flaky} />
        </span>
        <span className="mono hidden text-[12px] tabular-nums text-[var(--ink-2)] sm:block">
          {row.passed_trials}/{row.trials}
        </span>
        <span className="mono hidden text-[12px] tabular-nums sm:block">
          {score(row.quality_avg)}
        </span>
        <span className="hidden justify-end sm:flex">
          {history.length > 1 ? (
            <Sparkline values={history} tone={row.passed ? "ok" : row.flaky ? "warn" : "danger"} width={72} height={22} label={`${row.case_id} quality across ${history.length} runs`} />
          ) : (
            <span className="t-meta">—</span>
          )}
        </span>
        <span className="mono hidden text-right text-[12px] tabular-nums text-[var(--ink-2)] sm:block">
          {duration(row.latency_p50_ms)}
        </span>
      </summary>

      <div className="space-y-3 bg-[var(--surface-2)] px-4 pb-4 pt-2">
        {trials.map((trial) => (
          <div key={`${trial.case_id}-${trial.trial ?? 0}`} className="surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              {trials.length > 1 ? (
                <span className="t-label">Trial {(trial.trial ?? 0) + 1}</span>
              ) : null}
              <span className="chip mono !text-[11px]">{trial.status}</span>
              {trial.outcome ? (
                <span className="chip mono !text-[11px]">{trial.outcome}</span>
              ) : null}
              <span className="mono text-[11px] text-[var(--ink-3)]">
                {(trial.tools_called ?? []).join(", ") || "no tools"}
              </span>
              {trial.langfuse_trace_url ? (
                <a
                  href={trial.langfuse_trace_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-[12px] font-medium text-[var(--accent-ink)] hover:underline"
                >
                  Langfuse trace ↗
                </a>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(trial.scores ?? {}).map(([name, value]) => (
                <span
                  key={name}
                  className={`chip mono !text-[11px] ${
                    name !== "latency" && Number(value) < 1 ? "chip-danger" : ""
                  }`}
                >
                  {name} {score(value)}
                </span>
              ))}
            </div>
            {trial.error ? (
              <p className="mt-2 text-[12.5px] text-[var(--danger-ink)]">⚠ {trial.error}</p>
            ) : null}
            {trial.response ? (
              <pre className="scroll mono mt-2 max-h-40 whitespace-pre-wrap rounded-[8px] bg-[var(--surface-2)] p-2.5 text-[11.5px] leading-[1.6] text-[var(--ink-2)]">
                {trial.response}
              </pre>
            ) : null}
          </div>
        ))}
        {!trials.length ? <p className="t-meta">No trial detail recorded.</p> : null}
      </div>
    </details>
  );
}

function EmptyEvals({ dir, legacy, missing }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <p className="t-label">No runs yet</p>
      <h2 className="t-h1 mt-3">Run the harness and results appear here.</h2>
      <p className="t-body mx-auto mt-3 max-w-md">
        {missing
          ? "The results directory doesn't exist yet."
          : legacy
            ? `Found ${legacy} legacy result file(s) from before versioned envelopes; re-run to see them here.`
            : "The results directory has no run envelopes."}
      </p>
      <pre className="mono mx-auto mt-6 w-fit rounded-[var(--r)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-[12.5px] leading-[1.8]">
        <span className="text-[var(--ink-3)]">$</span> cd evals{"\n"}
        <span className="text-[var(--ink-3)]">$</span> uv run python -m src --dry-run --approve
      </pre>
      <p className="mono mt-4 break-all text-[11px] text-[var(--ink-3)]">{dir}</p>
    </div>
  );
}

/** Pass/fail change between the selected run and the one before it (same dataset). */
function diffAgainstPrevious(selected, previous) {
  if (!previous) return null;
  const was = new Map(previous.case_summary.map((c) => [c.case_id, c]));
  const out = { baseline_run: previous.run_name, regressions: [], fixes: [], still_failing: [], added: [], removed: [] };
  for (const c of selected.case_summary) {
    const p = was.get(c.case_id);
    if (!p) out.added.push(c.case_id);
    else if (p.passed && !c.passed) out.regressions.push(c.case_id);
    else if (!p.passed && c.passed) out.fixes.push(c.case_id);
    else if (!p.passed && !c.passed) out.still_failing.push(c.case_id);
  }
  const now = new Set(selected.case_summary.map((c) => c.case_id));
  for (const id of was.keys()) if (!now.has(id)) out.removed.push(id);
  out.aggregate_deltas = { overall: (Number(selected.aggregates.overall) || 0) - (Number(previous.aggregates.overall) || 0) };
  return out;
}

const median = (values) => {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
};

export function EvalsView({ wanted, base = "/dashboard/evals", data }) {
  const { dir, runs, legacy, missing } = data;

  if (!runs.length) {
    return <EmptyEvals dir={dir} legacy={legacy} missing={missing} />;
  }

  const selected = runs.find((r) => r.run_name === wanted) ?? runs[0];
  // Runs of the same dataset, oldest → newest, for sparklines and the diff.
  const sameDataset = runs.filter((r) => r.dataset === selected.dataset).sort((a, b) => a.started_ms - b.started_ms);
  const previous = sameDataset.filter((r) => r.started_ms < selected.started_ms).at(-1);
  const comparison = selected.comparison ?? diffAgainstPrevious(selected, previous);
  const series = sameDataset.slice(-12);
  const caseHistory = (id) => series.map((r) => r.case_summary.find((c) => c.case_id === id)?.quality_avg).filter((v) => v != null);
  const p50 = median(selected.case_summary.map((c) => c.latency_p50_ms));
  const p50Series = series.map((r) => median(r.case_summary.map((c) => c.latency_p50_ms))).filter((v) => v != null);
  const trialsByCase = new Map();
  for (const c of selected.cases) {
    if (!trialsByCase.has(c.case_id)) trialsByCase.set(c.case_id, []);
    trialsByCase.get(c.case_id).push(c);
  }
  const passRate = selected.case_count ? selected.passed / selected.case_count : 0;
  const filters = selected.filters ?? {};
  const filterText = [
    filters.case?.length ? `case: ${filters.case.join(", ")}` : null,
    filters.tag?.length ? `tag: ${filters.tag.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="page scroll">
      <div className="page-inner page-wide grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-4">
          <div className="enter flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="t-label">
                {selected.dataset} · v{selected.dataset_version}
                {selected.dry_run ? " · dry-run" : " · Langfuse"}
              </p>
              <h1 className="t-h1 page-title mt-1.5 truncate">{selected.run_name}</h1>
              <p className="t-meta mt-1">
                {relativeTime(selected.started_at)} · {selected.nexus_api_url}
                {selected.auto_approve ? " · auto-approve" : ""}
                {filterText ? ` · ${filterText}` : ""}
              </p>
            </div>
            <Verdict passed={selected.failed === 0} flaky={false} />
          </div>

          <div className="enter grid grid-cols-2 gap-3 md:grid-cols-4" style={{ "--i": 1 }}>
            <Stat
              hero
              label="Pass rate"
              value={pct(passRate)}
              sub={`${selected.passed} of ${selected.case_count} cases`}
              trend={series.map((r) => (r.case_count ? r.passed / r.case_count : 0))}
              tone={selected.failed === 0 ? "ok" : "danger"}
            />
            <Stat
              label="Overall quality"
              value={score(selected.aggregates.overall)}
              sub="latency excluded"
              trend={series.map((r) => Number(r.aggregates.overall) || 0)}
            />
            <Stat
              label="Flaky"
              value={selected.flaky}
              sub={`${selected.repeat} trial${selected.repeat === 1 ? "" : "s"} per case`}
              trend={series.map((r) => r.flaky ?? 0)}
              tone={selected.flaky ? "warn" : undefined}
            />
            <Stat
              label="Latency p50"
              value={duration(p50)}
              sub={`run took ${duration(selected.duration_ms)}`}
              trend={p50Series}
            />
          </div>

          <div className="enter grid gap-4 xl:grid-cols-[1.3fr_1fr]" style={{ "--i": 2 }}>
            <Trend runs={runs} selected={selected} base={base} />
            <Breakdown aggregates={selected.aggregates} />
          </div>

          {comparison ? (
            <div className="enter" style={{ "--i": 3 }}>
              <Comparison comparison={comparison} />
            </div>
          ) : null}

          <section className="enter card section-card overflow-hidden" style={{ "--i": 3 }}>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_90px_70px_80px_96px_100px] gap-3 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 sm:grid">
              {["Case", "Verdict", "Trials", "Quality", "Trend", "p50 latency"].map((h, i) => (
                <span key={h} className={`t-label ${i >= 4 ? "text-right" : ""}`}>
                  {h}
                </span>
              ))}
            </div>
            {selected.case_summary.map((row, index) => (
              <CaseRow
                key={row.case_id}
                row={row}
                index={index}
                history={caseHistory(row.case_id)}
                trials={trialsByCase.get(row.case_id) ?? []}
              />
            ))}
          </section>
        </div>

        <aside className="enter space-y-2 lg:sticky lg:top-0 lg:self-start" style={{ "--i": 2 }}>
          <p className="t-label px-1">Runs · {runs.length}</p>
          <nav className="scroll max-h-[70vh] space-y-1.5">
            {runs.map((run) => {
              const active = run === selected;
              return (
                <Link
                  key={run.file}
                  href={`${base}?run=${encodeURIComponent(run.run_name)}`}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-[var(--r)] border px-3 py-2.5 transition-colors ${
                    active
                      ? "border-[var(--accent-line)] bg-[var(--accent-bg)]"
                      : "border-transparent hover:border-[var(--line)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`dot ${run.failed === 0 ? "dot-ok" : "dot-danger"}`}
                      aria-hidden
                    />
                    <span className="truncate text-[12.5px] font-medium">{run.run_name}</span>
                  </span>
                  <span className="mono mt-0.5 block pl-[14px] text-[10.5px] text-[var(--ink-3)]">
                    {run.dataset} · {run.passed}/{run.case_count} · {score(run.aggregates.overall)} ·{" "}
                    {relativeTime(run.started_at)}
                  </span>
                </Link>
              );
            })}
          </nav>
          {legacy ? (
            <p className="t-meta px-1">{legacy} legacy file(s) skipped (pre-envelope format).</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
