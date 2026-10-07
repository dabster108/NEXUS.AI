"""JUnit XML export, so any CI system can render an eval run as tests.

One ``<testcase>`` per eval case (not per trial): the unit a reviewer acts on
is the case. Repeated trials surface in the failure message as a pass rate.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


def build_junit(envelope: dict[str, Any]) -> ET.ElementTree:
    """Project a run envelope into a JUnit ``<testsuite>`` tree."""
    summary = envelope.get("case_summary") or []
    trials_by_case: dict[str, list[dict[str, Any]]] = {}
    for case in envelope.get("cases") or []:
        trials_by_case.setdefault(str(case.get("case_id")), []).append(case)

    total_seconds = sum(
        float(case.get("latency_ms") or 0.0) for case in envelope.get("cases") or []
    ) / 1000
    suite = ET.Element(
        "testsuite",
        {
            "name": f"nexus-evals.{envelope.get('dataset', 'unknown')}",
            "tests": str(len(summary)),
            "failures": str(sum(1 for row in summary if not row.get("passed"))),
            "errors": "0",
            "time": f"{total_seconds:.3f}",
            "timestamp": str(envelope.get("started_at") or ""),
        },
    )
    props = ET.SubElement(suite, "properties")
    for key in ("run_name", "dataset_version", "nexus_api_url", "repeat"):
        ET.SubElement(props, "property", {"name": key, "value": str(envelope.get(key, ""))})

    for row in summary:
        case_id = str(row["case_id"])
        trials = trials_by_case.get(case_id, [])
        seconds = sum(float(t.get("latency_ms") or 0.0) for t in trials) / 1000
        testcase = ET.SubElement(
            suite,
            "testcase",
            {
                "classname": f"nexus-evals.{envelope.get('dataset', 'unknown')}",
                "name": case_id,
                "time": f"{seconds:.3f}",
            },
        )
        if row.get("passed"):
            continue
        worst = min(trials, key=lambda t: float(t.get("quality_avg") or 0.0), default={})
        low = sorted(
            (name, value)
            for name, value in (worst.get("scores") or {}).items()
            if name != "latency" and float(value) < 1.0
        )
        message = (
            f"passed {row.get('passed_trials', 0)}/{row.get('trials', 0)} trial(s); "
            f"quality {float(row.get('quality_avg') or 0.0):.2f}"
        )
        detail = [
            f"status: {worst.get('status', '')}",
            f"tools: {', '.join(worst.get('tools_called') or []) or '—'}",
            "low scores: " + (", ".join(f"{n}={v:.2f}" for n, v in low) or "—"),
        ]
        if worst.get("error"):
            detail.append(f"error: {worst['error']}")
        failure = ET.SubElement(testcase, "failure", {"message": message})
        failure.text = "\n".join(detail)

    tree = ET.ElementTree(suite)
    ET.indent(tree)
    return tree


def write_junit(envelope: dict[str, Any], path: Path) -> Path:
    """Write the JUnit XML file and return its path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    build_junit(envelope).write(path, encoding="utf-8", xml_declaration=True)
    return path
