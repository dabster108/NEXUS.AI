"""Filtering, repeated trials, baseline comparison, and JUnit export."""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.aggregates import aggregate_scores, percentile, summarize_trials
from src.compare import compare_envelopes, comparison_lines, format_delta, load_envelope
from src.config import EvalConfig
from src.dataset import EvalCase, EvalDataset, select_cases
from src.harness import EvalHarness, format_reliability_line
from src.junit import build_junit
from src.report import build_run_envelope
from src.runner import EvalResult, run_dataset
from src.schema import RUN_SCHEMA

GOOD = {
    "tool_selection": 1.0,
    "event_contract": 1.0,
    "outcome": 1.0,
    "keywords": 1.0,
    "completion": 1.0,
    "latency": 1.0,
    "safety": 1.0,
}
BAD = {**GOOD, "tool_selection": 0.0, "outcome": 0.0, "keywords": 0.0}


def _ok(case_id: str, trial: int = 0, latency: float = 100.0) -> EvalResult:
    return EvalResult(
        case_id=case_id, trial=trial, status="completed", scores=dict(GOOD), latency_ms=latency
    )


def _bad(case_id: str, trial: int = 0) -> EvalResult:
    return EvalResult(
        case_id=case_id, trial=trial, status="completed", scores=dict(BAD), latency_ms=300.0
    )


def _envelope(results: list[EvalResult], run_name: str = "run") -> dict:
    return build_run_envelope(
        results,
        dataset="smoke",
        dataset_version="1",
        run_name=run_name,
        nexus_api_url="http://127.0.0.1:8000",
        dry_run=True,
        auto_approve=False,
        started_at="2026-09-29T00:00:00+00:00",
    )


CASES = (
    EvalCase(id="a", input="a?", tags=["safe", "system"]),
    EvalCase(id="b", input="b?", tags=["confirm"]),
    EvalCase(id="c", input="c?", tags=["safe", "git"]),
)


# --- event_contract now gates quality ------------------------------------


def test_event_contract_counts_toward_overall() -> None:
    missing_event = EvalResult(
        case_id="memory_recall",
        status="completed",
        scores={**GOOD, "event_contract": 0.0},
    )
    means = aggregate_scores([missing_event])
    assert means["overall"] < 1.0


# --- selection -----------------------------------------------------------


def test_select_by_id_and_tag() -> None:
    assert [c.id for c in select_cases(CASES, ids=["a", "b"])] == ["a", "b"]
    assert [c.id for c in select_cases(CASES, tags=["safe"])] == ["a", "c"]
    assert [c.id for c in select_cases(CASES, ids=["a", "b"], tags=["safe"])] == ["a"]
    assert len(select_cases(CASES)) == 3


def test_select_rejects_unknown_id_and_empty_result() -> None:
    with pytest.raises(ValueError, match="Unknown case id"):
        select_cases(CASES, ids=["nope"])
    with pytest.raises(ValueError, match="No cases match"):
        select_cases(CASES, tags=["network"])


# --- repeated trials -----------------------------------------------------


def test_summarize_trials_pass_k_and_flaky() -> None:
    rows = summarize_trials([_ok("a", 0), _bad("a", 1), _ok("b", 0), _ok("b", 1)])
    by_id = {row["case_id"]: row for row in rows}
    assert [row["case_id"] for row in rows] == ["a", "b"]
    assert by_id["a"] == {
        **by_id["a"],
        "trials": 2,
        "passed_trials": 1,
        "pass_rate": 0.5,
        "passed": False,
        "flaky": True,
    }
    assert by_id["b"]["passed"] is True and by_id["b"]["flaky"] is False


def test_percentile_nearest_rank() -> None:
    assert percentile([], 50) == 0.0
    assert percentile([10.0], 50) == 10.0
    assert percentile([1.0, 2.0, 3.0, 4.0], 50) == 2.0
    assert percentile([1.0, 2.0, 3.0, 4.0], 100) == 4.0


def test_envelope_counts_cases_not_trials() -> None:
    env = _envelope([_ok("a", 0), _bad("a", 1), _ok("b", 0), _ok("b", 1)])
    assert env["case_count"] == 2
    assert env["trial_count"] == 4
    assert env["repeat"] == 2
    assert env["passed"] == 1 and env["failed"] == 1
    assert env["flaky"] == 1
    assert [c["trial"] for c in env["cases"]] == [0, 1, 0, 1]


def test_single_trial_envelope_is_unchanged_shape() -> None:
    env = _envelope([_ok("a"), _bad("b")])
    assert env["schema"] == RUN_SCHEMA
    assert env["case_count"] == 2 and env["passed"] == 1 and env["failed"] == 1
    assert env["repeat"] == 1 and env["flaky"] == 0


@pytest.mark.asyncio
async def test_run_dataset_repeats_grouped_by_case() -> None:
    calls: list[tuple[str, int]] = []

    async def fake_run_case(case, config, **kwargs):
        calls.append((case.id, kwargs["trial"]))
        return EvalResult(case_id=case.id, trial=kwargs["trial"])

    with patch("src.runner.run_case", new=fake_run_case):
        results = await run_dataset(list(CASES[:2]), config=None, repeat=3, timeout=5)

    assert [(r.case_id, r.trial) for r in results] == [
        ("a", 0), ("a", 1), ("a", 2), ("b", 0), ("b", 1), ("b", 2),
    ]
    assert len(calls) == 6


# --- comparison ----------------------------------------------------------


def test_compare_flags_regressions_fixes_and_membership() -> None:
    baseline = _envelope([_ok("a"), _bad("b"), _ok("c"), _bad("gone")], "base")
    current = _envelope([_bad("a"), _ok("b"), _ok("c"), _ok("new")], "cur")
    diff = compare_envelopes(baseline, current)
    assert diff["baseline_run"] == "base"
    assert diff["regressions"] == ["a"]
    assert diff["fixes"] == ["b"]
    assert diff["still_failing"] == []
    assert diff["added"] == ["new"]
    assert diff["removed"] == ["gone"]
    assert "overall" in diff["aggregate_deltas"]
    assert any("regressions" in line and "a" in line for line in comparison_lines(diff))


def test_compare_handles_envelope_without_case_summary() -> None:
    legacy_v1 = _envelope([_ok("a"), _ok("b")], "base")
    legacy_v1.pop("case_summary")
    diff = compare_envelopes(legacy_v1, _envelope([_bad("a"), _ok("b")]))
    assert diff["regressions"] == ["a"]


def test_format_delta() -> None:
    assert format_delta(0.0) == "±0.00"
    assert format_delta(0.123) == "+0.12"
    assert format_delta(-0.05) == "-0.05"


def test_load_envelope_rejects_legacy_list(tmp_path: Path) -> None:
    legacy = tmp_path / "old.json"
    legacy.write_text(json.dumps([{"case_id": "a"}]))
    with pytest.raises(ValueError, match="not a nexus-evals/v1"):
        load_envelope(legacy)
    with pytest.raises(FileNotFoundError):
        load_envelope(tmp_path / "missing.json")


# --- junit ---------------------------------------------------------------


def test_junit_one_testcase_per_case_with_failure_detail() -> None:
    env = _envelope([_ok("a", 0), _bad("a", 1), _ok("b", 0), _ok("b", 1)])
    suite = build_junit(env).getroot()
    assert suite.tag == "testsuite"
    assert suite.get("tests") == "2" and suite.get("failures") == "1"
    cases = {tc.get("name"): tc for tc in suite.iter("testcase")}
    failure = cases["a"].find("failure")
    assert failure is not None
    assert "passed 1/2" in failure.get("message", "")
    assert "tool_selection=0.00" in (failure.text or "")
    assert cases["b"].find("failure") is None
    ET.tostring(suite)  # serialisable


# --- harness end-to-end (mocked target) ----------------------------------


def _config() -> EvalConfig:
    return EvalConfig(
        langfuse_secret_key=None,
        langfuse_public_key=None,
        langfuse_host="https://us.cloud.langfuse.com",
        langfuse_environment="dev",
        nexus_api_url="http://127.0.0.1:8000",
        dry_run=True,
    )


def _dataset(tmp_path: Path) -> EvalDataset:
    return EvalDataset(name="smoke", version="1", cases=CASES, path=tmp_path / "smoke.yaml")


@pytest.mark.asyncio
async def test_harness_filters_compares_and_writes_junit(tmp_path: Path) -> None:
    alias = tmp_path / "smoke.json"
    alias.write_text(json.dumps(_envelope([_ok("a"), _ok("c")], "yesterday")))

    run_mock = AsyncMock(return_value=[_bad("a"), _ok("c")])
    with (
        patch("src.harness.run_dataset", new=run_mock),
        patch("src.harness.load_eval_dataset", return_value=_dataset(tmp_path)),
    ):
        harness = EvalHarness(
            config=_config(),
            dataset_name="smoke",
            run_name="today",
            skip_health=True,
            skip_sync=True,
            results_dir=tmp_path,
            tags=["safe"],
            repeat=2,
            timeout=12.0,
            baseline=alias,
            junit=tmp_path / "junit.xml",
            log=lambda _msg: None,
        )
        run = await harness.run()

    sent_cases = run_mock.await_args.args[0]
    assert [c.id for c in sent_cases] == ["a", "c"]
    assert run_mock.await_args.kwargs["repeat"] == 2
    assert run_mock.await_args.kwargs["timeout"] == 12.0

    assert run.regressions == ["a"]
    assert run.envelope["comparison"]["baseline_run"] == "yesterday"
    assert run.envelope["filters"] == {"case": [], "tag": ["safe"]}
    assert run.artifacts.junit_path is not None and run.artifacts.junit_path.exists()
    # A filtered run must leave the dataset alias (the baseline) untouched.
    assert run.artifacts.alias_path is None
    assert json.loads(alias.read_text())["run_name"] == "yesterday"
    assert "vs baseline `yesterday`" in run.artifacts.markdown_path.read_text()


@pytest.mark.asyncio
async def test_harness_reads_baseline_before_overwriting_alias(tmp_path: Path) -> None:
    alias = tmp_path / "smoke.json"
    alias.write_text(json.dumps(_envelope([_ok("a"), _ok("b"), _ok("c")], "yesterday")))

    with (
        patch(
            "src.harness.run_dataset",
            new=AsyncMock(return_value=[_ok("a"), _bad("b"), _ok("c")]),
        ),
        patch("src.harness.load_eval_dataset", return_value=_dataset(tmp_path)),
    ):
        run = await EvalHarness(
            config=_config(),
            dataset_name="smoke",
            run_name="today",
            skip_health=True,
            skip_sync=True,
            results_dir=tmp_path,
            baseline=alias,
            log=lambda _msg: None,
        ).run()

    assert run.regressions == ["b"]
    assert json.loads(alias.read_text())["run_name"] == "today"


def test_reliability_line_marks_flaky_and_failed() -> None:
    rows = {r["case_id"]: r for r in summarize_trials(
        [_ok("a", 0), _bad("a", 1), _ok("b", 0), _ok("b", 1), _bad("c", 0), _bad("c", 1)]
    )}
    assert format_reliability_line(rows["a"]).lstrip().startswith("≈ a")
    assert "1/2 trials" in format_reliability_line(rows["a"])
    assert format_reliability_line(rows["b"]).lstrip().startswith("✓ b")
    assert format_reliability_line(rows["c"]).lstrip().startswith("✗ c")
