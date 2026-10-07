"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "./motion";
import { Terminal } from "../ui/primitives";

/**
 * The eval harness, printing a run.
 *
 * The command and the line format are the real CLI's; the numbers are an
 * illustrative run of the `core` dataset, and the caption says so. It prints
 * once when it scrolls into view and can be replayed: each case's ✓ ticks in,
 * its quality bar fills, and the one flaky case keeps pulsing amber, because a
 * flaky pass is exactly what the harness refuses to call a pass.
 */

const COMMAND =
  "uv run python -m src -d core --approve --repeat 3 --compare results/core.json";

const CASES = [
  ["battery_check", 3, 1.0, "2.1s"],
  ["workspace_detection", 3, 1.0, "3.4s"],
  ["git_status_check", 3, 1.0, "2.8s"],
  ["list_running_processes", 3, 0.96, "3.0s"],
  ["system_info", 3, 1.0, "1.9s"],
  ["repo_overview", 3, 0.93, "4.6s"],
  ["memory_recall", 2, 0.81, "3.3s"],
  ["local_service_check", 3, 1.0, "2.2s"],
  ["confirm_gate_test", 3, 1.0, "5.1s"],
  ["refusal_test", 3, 1.0, "1.4s"],
].map(([name, passed, quality, p50]) => ({
  t: "case",
  name,
  passed,
  quality,
  p50,
  flaky: passed < 3,
}));

const HEAD = [
  { t: "info", s: "▸ Running 10 case(s) × 3 trial(s) from 'core' v1" },
  { t: "dim", s: "  … 30 trial lines …" },
  { t: "blank", s: "" },
  { t: "info", s: "  Reliability (every trial must pass):" },
];

const TAIL = [
  { t: "blank", s: "" },
  { t: "info", s: "  Passed 9/10" },
  { t: "warn", s: "  Flaky  1  (memory_recall)" },
  { t: "blank", s: "" },
  { t: "info", s: "  Compared with baseline `core-20260928-091412`:" },
  { t: "info", s: "    regressions    none" },
  { t: "pass", s: "    fixed          repo_overview" },
  { t: "info", s: "    overall Δ      +0.04" },
  { t: "blank", s: "" },
  { t: "fail", s: "  ✗ Gate: 1 case(s) failed" },
];

const LINES = [...HEAD, ...CASES, ...TAIL];

function CaseRow({ line }) {
  const { name, passed, quality, p50, flaky } = line;
  return (
    <span className={`term-line term-case ${flaky ? "is-flaky" : ""}`}>
      <span className={flaky ? "term-warn" : "term-pass"}>
        <span className="term-tick">{flaky ? "≈" : "✓"}</span>{" "}
      </span>
      <span className="term-info">{name.padEnd(24)}</span>
      <span className="term-dim">{`${passed}/3 trials  `}</span>
      <span className={flaky ? "term-warn" : "term-info"}>{`q=${quality.toFixed(2)} `}</span>
      <span className="term-bar" aria-hidden>
        <i className={flaky ? "is-warn" : ""} style={{ "--q": quality }} />
      </span>
      <span className="term-dim">{`  p50=${p50}`}</span>
      {"\n"}
    </span>
  );
}

export function HarnessTerminal() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const seen = useInView(ref, { once: true, threshold: 0.4 });
  const [typed, setTyped] = useState(0);
  const [lines, setLines] = useState(0);
  const [run, setRun] = useState(0);

  const done = reduced || lines >= LINES.length;
  const commandShown = reduced ? COMMAND.length : typed;
  const linesShown = reduced ? LINES.length : lines;

  useEffect(() => {
    if (!seen || reduced) return;
    if (typed < COMMAND.length) {
      const id = setTimeout(() => setTyped((n) => n + 2), 18);
      return () => clearTimeout(id);
    }
    if (lines < LINES.length) {
      const next = LINES[lines];
      const id = setTimeout(
        () => setLines((n) => n + 1),
        lines === 0 ? 380 : next?.t === "case" ? 260 : 130,
      );
      return () => clearTimeout(id);
    }
  }, [seen, reduced, typed, lines, run]);

  return (
    <Terminal
      ref={ref}
      title="evals — zsh"
      actions={
        done && !reduced ? (
          <button
            type="button"
            className="dk-btn !py-0.5 !text-[11px]"
            onClick={() => {
              setTyped(0);
              setLines(0);
              setRun((n) => n + 1);
            }}
          >
            ↻ Replay
          </button>
        ) : null
      }
    >
      <pre
        key={run}
        className="mono overflow-x-auto p-4 text-[12px] leading-[1.8] text-[var(--term-ink-2)]"
        aria-label="Illustrative eval harness output"
      >
        <span className="text-[var(--term-prompt)]">$ </span>
        <span className="text-[var(--term-ink)]">{COMMAND.slice(0, commandShown)}</span>
        {commandShown < COMMAND.length || !done ? <span className="type-caret !bg-white/80" /> : null}
        {"\n"}
        {LINES.slice(0, linesShown).map((line, i) =>
          line.t === "case" ? (
            <CaseRow key={i} line={line} />
          ) : (
            <span key={i} className={`term-line term-${line.t}`}>
              {line.s}
              {"\n"}
            </span>
          ),
        )}
      </pre>
    </Terminal>
  );
}
