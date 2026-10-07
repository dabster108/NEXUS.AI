"""Local reports and run artifact envelopes."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from src.aggregates import aggregate_scores, case_average, passed_case, summarize_trials
from src.compare import format_delta
from src.runner import EvalResult
from src.schema import RUN_SCHEMA


def build_run_envelope(
    results: Sequence[EvalResult],
    *,
    dataset: str,
    dataset_version: str,
    run_name: str,
    nexus_api_url: str,
    dry_run: bool,
    auto_approve: bool,
    started_at: str,
    finished_at: str | None = None,
    filters: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    """Stable JSON shape for one eval run (harness artifact)."""
    finished = finished_at or datetime.now(UTC).isoformat()
    aggregates = aggregate_scores(results)
    cases = [
        {
            "case_id": r.case_id,
            "trial": r.trial,
            "task_id": r.task_id,
            "status": r.status,
            "response": r.response,
            "tools_called": r.tools_called,
            "outcome": r.outcome,
            "scores": r.scores,
            "quality_avg": round(case_average(r.scores), 4),
            "passed": passed_case(r),
            "latency_ms": r.latency_ms,
            "error": r.error,
            "langfuse_trace_url": r.langfuse_trace_url,
        }
        for r in results
    ]
    # Verdicts are per case, not per trial: with --repeat a case passes only
    # when every one of its trials did (pass^k).
    summary = summarize_trials(results)
    passed = sum(1 for row in summary if row["passed"])
    return {
        "schema": RUN_SCHEMA,
        "run_name": run_name,
        "dataset": dataset,
        "dataset_version": dataset_version,
        "started_at": started_at,
        "finished_at": finished,
        "nexus_api_url": nexus_api_url,
        "dry_run": dry_run,
        "auto_approve": auto_approve,
        "case_count": len(summary),
        "trial_count": len(cases),
        "repeat": max((row["trials"] for row in summary), default=1),
        "passed": passed,
        "failed": len(summary) - passed,
        "flaky": sum(1 for row in summary if row["flaky"]),
        "filters": filters or {},
        "aggregates": {k: round(v, 4) for k, v in aggregates.items()},
        "case_summary": summary,
        "cases": cases,
    }


def write_markdown_report(
    results: Sequence[EvalResult],
    *,
    dataset: str,
    path: Path,
    dry_run: bool,
    nexus_api_url: str,
    run_name: str = "",
    dataset_version: str = "",
    aggregates: dict[str, float] | None = None,
    comparison: dict[str, Any] | None = None,
) -> Path:
    """Write a human-readable scorecard next to the JSON results."""
    path.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    means = aggregates or aggregate_scores(results)
    summary = summarize_trials(results)
    passed = sum(1 for row in summary if row["passed"])
    repeat = max((row["trials"] for row in summary), default=1)

    lines = [
        f"# NEXUS eval — `{dataset}`",
        "",
        f"- When: {now}",
        f"- Backend: `{nexus_api_url}`",
        f"- Run: `{run_name or '—'}`",
        f"- Dataset version: `{dataset_version or '—'}`",
        f"- Mode: {'dry-run (local only)' if dry_run else 'Langfuse + local'}",
        f"- Cases: {len(summary)} (passed {passed}, failed {len(summary) - passed})",
        f"- Trials per case: {repeat}",
        "",
        "## Aggregate",
        "",
        "| Score | Mean |",
        "| --- | ---: |",
    ]
    for k, v in means.items():
        label = f"**{k}**" if k == "overall" else f"`{k}`"
        lines.append(f"| {label} | {v:.2f} |")
    lines.append("")
    lines.append("_`overall` excludes diagnostic `latency`._")
    lines.extend(["", "## Cases", ""])
    lines.append("| Case | Status | Tools | Quality | Latency |")
    lines.append("| --- | --- | --- | ---: | ---: |")

    for r in results:
        avg = case_average(r.scores)
        tools = ", ".join(r.tools_called) if r.tools_called else "—"
        mark = "✓" if passed_case(r) else "✗"
        label = f"{r.case_id}#{r.trial}" if repeat > 1 else r.case_id
        lines.append(
            f"| {mark} `{label}` | `{r.status}` | {tools} | {avg:.2f} | {r.latency_ms:.0f}ms |"
        )
        if r.error:
            lines.append(f"|  | ⚠ {r.error} |  |  |  |")

    if repeat > 1:
        lines.extend(["", "## Reliability", ""])
        lines.append("| Case | Pass rate | Flaky | Quality | p50 latency |")
        lines.append("| --- | ---: | :---: | ---: | ---: |")
        for row in summary:
            lines.append(
                f"| `{row['case_id']}` | {row['passed_trials']}/{row['trials']} "
                f"| {'⚠' if row['flaky'] else ''} | {row['quality_avg']:.2f} "
                f"| {row['latency_p50_ms']:.0f}ms |"
            )

    if comparison:
        lines.extend(["", f"## vs baseline `{comparison.get('baseline_run')}`", ""])
        for label, key in (
            ("Regressions", "regressions"),
            ("Fixed", "fixes"),
            ("Still failing", "still_failing"),
            ("New cases", "added"),
            ("Removed cases", "removed"),
        ):
            items = comparison.get(key) or []
            shown = ", ".join(f"`{c}`" for c in items) if items else "none"
            lines.append(f"- **{label}:** {shown}")
        deltas = comparison.get("aggregate_deltas") or {}
        if deltas:
            lines.extend(["", "| Score | Δ |", "| --- | ---: |"])
            for name, delta in deltas.items():
                lines.append(f"| `{name}` | {format_delta(delta)} |")

    lines.append("")
    path.write_text("\n".join(lines))
    return path
