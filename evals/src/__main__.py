"""CLI entry point for the NEXUS eval harness.

Usage:
    cd evals
    uv run python -m src --check
    uv run python -m src --sync -d smoke
    uv run python -m src -d smoke --approve
    uv run python -m src --dry-run --approve   # live run, no Langfuse upload
    uv run python -m src -d core --approve --repeat 3 --compare results/core.json
    uv run python -m src --dry-run --tag safe --junit results/junit.xml
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path

from src.client import check_auth, flush, shutdown
from src.compare import comparison_lines
from src.config import EvalConfig
from src.dataset import list_datasets, load_eval_dataset
from src.harness import EvalHarness, format_case_line, format_reliability_line
from src.sync import sync_dataset


def _default_run_name(dataset: str) -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    return f"{dataset}-{stamp}"


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="nexus-evals",
        description=(
            "Evaluation harness for NEXUS: versioned cases → live target → "
            "deterministic scores → artifacts (+ optional Langfuse)."
        ),
    )
    p.add_argument(
        "--dataset",
        "-d",
        default="smoke",
        help="Dataset in evals/datasets/ (default: smoke). Use 'core' for the full set.",
    )
    p.add_argument(
        "--run-name",
        default=None,
        help="Name for this eval run (default: <dataset>-<timestamp>)",
    )
    p.add_argument(
        "--approve",
        action="store_true",
        help="Auto-approve CONFIRM tool requests during eval",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Skip Langfuse (no credentials required). Still LIVE: it calls the "
            "backend and the real model, and with --approve it approves CONFIRM "
            "tools on this Mac."
        ),
    )
    p.add_argument(
        "--sync",
        action="store_true",
        help="Upsert the local YAML dataset into Langfuse Datasets and exit",
    )
    p.add_argument(
        "--no-sync",
        action="store_true",
        help="Skip auto-syncing the dataset to Langfuse before a live run",
    )
    p.add_argument(
        "--concurrency",
        "-c",
        type=int,
        default=1,
        help="Max concurrent eval cases (default: 1; forced to 1 with --approve)",
    )
    p.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="Write run envelope JSON here (default: results/<run_name>.json)",
    )
    p.add_argument(
        "--list",
        action="store_true",
        dest="list_datasets",
        help="List available datasets and exit",
    )
    p.add_argument(
        "--check",
        action="store_true",
        help="Verify Langfuse credentials (auth_check) and exit",
    )
    p.add_argument(
        "--case",
        action="append",
        default=[],
        metavar="ID",
        help="Run only this case id (repeatable)",
    )
    p.add_argument(
        "--tag",
        action="append",
        default=[],
        metavar="TAG",
        help="Run only cases carrying this tag (repeatable; any tag matches)",
    )
    p.add_argument(
        "--repeat",
        "-r",
        type=int,
        default=1,
        help="Trials per case; a case passes only if every trial passes (default: 1)",
    )
    p.add_argument(
        "--timeout",
        type=float,
        default=90.0,
        help="Seconds to wait for each task to finish (default: 90)",
    )
    p.add_argument(
        "--compare",
        metavar="BASELINE",
        default=None,
        help="Compare against a previous run envelope; regressions fail the run",
    )
    p.add_argument(
        "--junit",
        metavar="PATH",
        default=None,
        help="Also write JUnit XML (one testcase per eval case) for CI",
    )
    p.add_argument(
        "--fail-under",
        type=float,
        default=None,
        metavar="SCORE",
        help="Fail the run when aggregate `overall` is below SCORE (0–1)",
    )
    p.add_argument(
        "--skip-health",
        action="store_true",
        help="Do not probe GET /health before running cases",
    )
    return p


def _log(msg: str) -> None:
    print(msg, flush=True)


def main() -> None:
    args = _build_parser().parse_args()

    if args.list_datasets:
        datasets = list_datasets()
        if not datasets:
            print("No datasets found in evals/datasets/")
        else:
            print("Available datasets:")
            for name in datasets:
                try:
                    ds = load_eval_dataset(name)
                    tags = sorted({tag for case in ds.cases for tag in case.tags})
                    print(f"  • {name:<10} v{ds.version}  {len(ds)} case(s)  tags: {', '.join(tags)}")
                except (ValueError, OSError) as exc:
                    print(f"  • {name:<10} (invalid: {exc})")
        return

    if args.repeat < 1:
        print("Config error: --repeat must be ≥ 1", file=sys.stderr)
        sys.exit(2)
    if args.fail_under is not None and not 0 <= args.fail_under <= 1:
        print("Config error: --fail-under must be between 0 and 1", file=sys.stderr)
        sys.exit(2)

    config = EvalConfig.from_env(dry_run=args.dry_run)
    run_name = args.run_name or _default_run_name(args.dataset)

    if args.check:
        try:
            config.require_langfuse()
        except RuntimeError as exc:
            print(f"Config error: {exc}", file=sys.stderr)
            sys.exit(1)
        print(f"Checking Langfuse at {config.langfuse_host} …", flush=True)
        try:
            ok = check_auth(config)
        except Exception as exc:
            print(f"✗ Langfuse unreachable: {exc}", file=sys.stderr)
            sys.exit(1)
        finally:
            shutdown()
        if not ok:
            print(
                "✗ Credentials rejected — check LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY",
                file=sys.stderr,
            )
            sys.exit(1)
        print("✓ Langfuse auth ok")
        print(f"  host:        {config.langfuse_host}")
        print(f"  environment: {config.langfuse_environment}")
        print(f"  nexus api:   {config.nexus_api_url}")
        return

    if args.sync:
        if args.dry_run:
            print("Config error: --sync requires Langfuse (drop --dry-run)", file=sys.stderr)
            sys.exit(1)
        try:
            config.require_langfuse()
        except RuntimeError as exc:
            print(f"Config error: {exc}", file=sys.stderr)
            sys.exit(1)
        print(f"▸ Syncing dataset '{args.dataset}' → Langfuse …", flush=True)
        try:
            result = sync_dataset(config, args.dataset)
        except Exception as exc:
            print(f"✗ Sync failed: {exc}", file=sys.stderr)
            shutdown()
            sys.exit(1)
        flush()
        shutdown()
        print(
            f"  ✓ {result.total} item(s) upserted into `{result.dataset}` "
            f"(v{result.version})"
        )
        return

    if not args.dry_run:
        try:
            config.require_langfuse()
        except RuntimeError as exc:
            print(f"Config error: {exc}", file=sys.stderr)
            sys.exit(1)

    harness = EvalHarness(
        config=config,
        dataset_name=args.dataset,
        run_name=run_name,
        auto_approve=args.approve,
        concurrency=args.concurrency,
        skip_health=args.skip_health,
        skip_sync=args.no_sync or args.dry_run,
        output=Path(args.output) if args.output else None,
        case_ids=args.case,
        tags=args.tag,
        repeat=args.repeat,
        timeout=args.timeout,
        baseline=Path(args.compare) if args.compare else None,
        junit=Path(args.junit) if args.junit else None,
        log=_log,
    )

    try:
        run = asyncio.run(harness.run())
    except FileNotFoundError as exc:
        print(f"Input error: {exc}", file=sys.stderr)
        shutdown()
        sys.exit(1)
    except ValueError as exc:
        print(f"Input error: {exc}", file=sys.stderr)
        shutdown()
        sys.exit(1)
    except Exception as exc:
        msg = str(exc).lower()
        if "connect" in msg or "unreachable" in msg or "health" in msg:
            print(
                f"✗ Backend unreachable ({exc}). "
                "Start it with: cd backend && uv run uvicorn app.main:app "
                "--host 127.0.0.1 --port 8000",
                file=sys.stderr,
                flush=True,
            )
            shutdown()
            sys.exit(1)
        shutdown()
        raise

    for r in run.results:
        print(format_case_line(r))
        if r.error:
            print(f"    ⚠ {r.error}")
        if r.langfuse_trace_url:
            print(f"    ↗ {r.langfuse_trace_url}")

    if run.envelope.get("repeat", 1) > 1:
        print()
        print("  Reliability (every trial must pass):")
        for row in run.envelope["case_summary"]:
            print(format_reliability_line(row))

    print()
    print("  Aggregate scores (overall excludes latency):")
    for k, v in run.aggregates.items():
        print(f"    {k:<20} {v:.2f}")

    print(f"\n  Results written to {run.artifacts.envelope_path}")
    if run.artifacts.alias_path is not None:
        print(f"  Alias written to   {run.artifacts.alias_path}")
    print(f"  Report written to  {run.artifacts.markdown_path}")
    if run.artifacts.junit_path is not None:
        print(f"  JUnit written to   {run.artifacts.junit_path}")
    print(f"  Passed {run.envelope['passed']}/{run.envelope['case_count']}")
    if run.envelope.get("repeat", 1) > 1:
        flaky = [row["case_id"] for row in run.envelope["case_summary"] if row["flaky"]]
        print(f"  Flaky  {len(flaky)}" + (f"  ({', '.join(flaky)})" if flaky else ""))
    if run.comparison is not None:
        print()
        for line in comparison_lines(run.comparison):
            print(line)

    if config.langfuse_enabled:
        flush()
        shutdown()
        print("  Langfuse events flushed ✓")
        print(
            f"  Filter in Langfuse by tag `run:{run_name}` "
            f"or environment `{config.langfuse_environment}`"
        )
    else:
        print("  Dry-run: skipped Langfuse (add keys later, then drop --dry-run)")

    overall = run.aggregates.get("overall", 0.0)
    gates: list[str] = []
    if run.envelope["failed"]:
        gates.append(f"{run.envelope['failed']} case(s) failed")
    if run.regressions:
        gates.append(f"{len(run.regressions)} regression(s) vs baseline")
    if args.fail_under is not None and overall < args.fail_under:
        gates.append(f"overall {overall:.2f} < --fail-under {args.fail_under:.2f}")
    if gates:
        print(f"\n  ✗ Gate: {'; '.join(gates)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
