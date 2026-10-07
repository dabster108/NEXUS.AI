"""Run-to-run comparison: turn two envelopes into a regression verdict.

A score going down is noise until it changes a verdict. So the comparison is
built around *cases that flipped* — passed in the baseline, fail now — with
aggregate deltas as supporting context. A regression is what CI should stop
on; a small drop in a mean is what a human should look at.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.schema import RUN_SCHEMA

#: An aggregate that moves less than this is reported as unchanged.
DELTA_EPSILON = 0.005


def load_envelope(path: Path) -> dict[str, Any]:
    """Read a ``nexus-evals/v1`` envelope; refuse anything else by name."""
    if not path.exists():
        raise FileNotFoundError(f"Baseline not found: {path}")
    data = json.loads(path.read_text())
    if not isinstance(data, dict) or data.get("schema") != RUN_SCHEMA:
        raise ValueError(
            f"Baseline {path} is not a {RUN_SCHEMA} envelope "
            "(legacy list artifacts cannot be compared)"
        )
    return data


def _case_verdicts(envelope: dict[str, Any]) -> dict[str, bool]:
    """case_id → passed, preferring the per-case trial summary when present."""
    summary = envelope.get("case_summary")
    if isinstance(summary, list) and summary:
        return {str(row["case_id"]): bool(row.get("passed")) for row in summary}
    verdicts: dict[str, bool] = {}
    for case in envelope.get("cases") or []:
        case_id = str(case.get("case_id"))
        # With repeated trials a case passes only if every trial did.
        verdicts[case_id] = verdicts.get(case_id, True) and bool(case.get("passed"))
    return verdicts


def compare_envelopes(
    baseline: dict[str, Any],
    current: dict[str, Any],
) -> dict[str, Any]:
    """Diff two runs. Pure: no I/O, stable key order, JSON-serialisable."""
    before = _case_verdicts(baseline)
    after = _case_verdicts(current)
    shared = [case_id for case_id in after if case_id in before]

    base_aggs = baseline.get("aggregates") or {}
    cur_aggs = current.get("aggregates") or {}
    deltas = {
        name: round(float(cur_aggs[name]) - float(base_aggs[name]), 4)
        for name in sorted(set(base_aggs) & set(cur_aggs))
    }

    return {
        "baseline_run": baseline.get("run_name"),
        "baseline_dataset_version": baseline.get("dataset_version"),
        "regressions": [c for c in shared if before[c] and not after[c]],
        "fixes": [c for c in shared if not before[c] and after[c]],
        "still_failing": [c for c in shared if not before[c] and not after[c]],
        "added": [c for c in after if c not in before],
        "removed": [c for c in before if c not in after],
        "aggregate_deltas": deltas,
    }


def format_delta(value: float) -> str:
    """``+0.12`` / ``-0.05`` / ``±0.00`` — sign always visible."""
    if abs(value) < DELTA_EPSILON:
        return "±0.00"
    return f"{value:+.2f}"


def comparison_lines(comparison: dict[str, Any]) -> list[str]:
    """Plain-text lines for the CLI summary."""
    lines = [f"  Compared with baseline `{comparison.get('baseline_run')}`:"]
    for label, key in (
        ("regressions", "regressions"),
        ("fixed", "fixes"),
        ("still failing", "still_failing"),
        ("new cases", "added"),
        ("removed cases", "removed"),
    ):
        items = comparison.get(key) or []
        if items or key == "regressions":
            shown = ", ".join(items) if items else "none"
            lines.append(f"    {label:<14} {shown}")
    overall = (comparison.get("aggregate_deltas") or {}).get("overall")
    if overall is not None:
        lines.append(f"    {'overall Δ':<14} {format_delta(overall)}")
    return lines
