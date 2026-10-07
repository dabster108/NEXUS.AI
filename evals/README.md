# NEXUS Evaluation Harness

External eval harness for NEXUS. Drives the live backend over HTTP, scores
deterministically, writes versioned run artifacts, and records observations in
**Langfuse** (Python SDK v4).

```text
Cases (YAML) → Target (NEXUS HTTP) → Judges (scorers)
                    │
                    ├── Artifacts: results/<run>.json (nexus-evals/v1)
                    ├── Report:    results/<run>.md   (+ optional JUnit XML)
                    ├── Gates:     failures · baseline regressions · --fail-under
                    └── Telemetry: Langfuse traces / scores / Datasets
```

Orchestration lives in ``src/harness.py``; the CLI only parses flags.

## Quick start

```bash
cd evals && uv sync

uv run python -m src --check                 # Langfuse keys
# or: uv run nexus-evals --check
# other terminal: backend on :8000
uv run python -m src --approve               # smoke + Langfuse (default)
uv run python -m src -d core --approve       # full suite
```

Filter Langfuse by tag `run:<run_name>` or environment `dev`. Dataset:
`nexus-evals-smoke`.

## Harness contract

Every run writes a **`nexus-evals/v1`** envelope:

| Field | Meaning |
| --- | --- |
| `run_name` / `dataset` / `dataset_version` | Identity of the run |
| `aggregates` | Per-score means + `overall` (excludes latency) |
| `passed` / `failed` | Cases where **every** trial completed with quality ≥ 0.7 |
| `repeat` / `trial_count` / `flaky` | Trials per case, total trials, cases that both passed and failed |
| `case_summary[]` | Per case: `pass_rate`, `flaky`, `quality_avg`, p50/max latency |
| `cases[]` | Per trial: scores, tools, trace URL, `passed`, `trial` |
| `filters` | `--case` / `--tag` selection, when used |
| `comparison` | Present with `--compare`: regressions, fixes, deltas |

Exit code **1** when any gate trips: a failed case, a regression against the
baseline, or `overall` below `--fail-under`. All fields added since the first
v1 release are additive; a single-trial run has the same counts as before.

## Commands

| Command | Purpose |
| --- | --- |
| `--check` | Verify Langfuse API keys |
| `--sync -d smoke` | Upsert YAML → Langfuse Dataset |
| `--approve` | Live run (auto-sync unless `--no-sync`) |
| `--dry-run --approve` | Local scores only |
| `--run-name demo-1` | Named run for dashboard filtering |
| `--list` | List YAML datasets with version, case count and tags |
| `--case ID` / `--tag TAG` | Run a subset (repeatable). Unknown ids are an error |
| `--repeat N` | N trials per case — pass^k verdicts and flakiness detection |
| `--compare results/core.json` | Diff against a previous envelope; regressions fail the run |
| `--junit results/junit.xml` | JUnit XML for CI test reporters |
| `--fail-under 0.85` | Quality floor on aggregate `overall` |
| `--timeout 120` | Per-task wait in seconds (default 90) |

Artifacts default to `results/<run_name>.json` (+ alias `results/<dataset>.json`).
A filtered run (`--case`/`--tag`) never rewrites the alias, so the alias stays a
full-dataset baseline. The baseline is read *before* the run, so comparing
against the alias the run is about to replace is safe:

```bash
uv run python -m src -d core --approve --repeat 3 \
  --compare results/core.json --junit results/junit.xml --fail-under 0.85
```

Runs are browsable in the frontend at <http://localhost:3000/evals>.

## Scores

| Score | Role |
| --- | --- |
| `tool_selection` | Expected tools called |
| `event_contract` | Every `expected_events` type was emitted (e.g. `memory_retrieved`) |
| `outcome` | Verdict / completed SAFE fallback |
| `keywords` | Expected terms (apostrophe-normalized) |
| `completion` | Status is `completed` |
| `safety` | Refusal / confirm-gate |
| `latency` | Diagnostic only — **not** in `overall` |
| `overall` | Mean of quality scores above |

## Datasets

| File | Use |
| --- | --- |
| `datasets/smoke.yaml` (`version: "1"`) | Default first pass |
| `datasets/core.yaml` (`version: "1"`) | Broader regression |

Remote Langfuse name: `nexus-evals-<local>`; item id `nexus-<local>-<case_id>`.

## Layout

```text
evals/
├── datasets/{smoke,core}.yaml
├── src/
│   ├── __main__.py     CLI
│   ├── harness.py      orchestration (cases→target→judges→artifacts)
│   ├── schema.py       RUN_SCHEMA = nexus-evals/v1
│   ├── aggregates.py   quality means + pass/fail
│   ├── client.py       Langfuse singleton
│   ├── config.py
│   ├── dataset.py      validated YAML loader
│   ├── sync.py         YAML → Langfuse Datasets
│   ├── runner.py       HTTP driver + Langfuse record
│   ├── scorers.py
│   ├── report.py       envelope + markdown
│   ├── compare.py      baseline diff → regressions
│   └── junit.py        JUnit XML export
└── tests/
```

Entry points: ``uv run python -m src …`` or ``uv run nexus-evals …``.

## Offline tests

```bash
uv run pytest
```
