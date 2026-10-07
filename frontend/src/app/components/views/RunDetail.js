"use client";

import { useEffect, useId, useState } from "react";
import { formatDuration } from "@/lib/runs";
import { clockTime } from "@/lib/format";
import { useApp } from "../shell/NexusProvider";
import { PipelineTrack, StageDetail } from "../run/PipelineTrack";
import { Badge, Skeleton } from "../ui/primitives";

/**
 * Everything about one run, for the timeline drawer: the nine stages, then the
 * evidence — what NEXUS saw before, what it verified after — and the raw
 * events. Before/after come from the backend's own trace endpoint when live
 * (context it provided, evidence it checked) and from the sample trace in the
 * demo; neither is composed here.
 */

const OUTCOME_TONE = { SUCCESS: "ok", PARTIAL_SUCCESS: "warn", FAILED: "danger", UNKNOWN: "neutral" };

export function RunDetail({ run }) {
  const { getTrace } = useApp();
  const panelId = useId();
  const [picked, setPicked] = useState(null);
  const [trace, setTrace] = useState({ id: null, value: null });

  useEffect(() => {
    let alive = true;
    getTrace(run.taskId).then((value) => alive && setTrace({ id: run.taskId, value }));
    return () => {
      alive = false;
    };
  }, [run.taskId, getTrace]);

  const loading = trace.id !== run.taskId;
  const t = trace.value;
  const stage = run.stages.find((s) => s.key === picked);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={run.status === "completed" ? "ok" : run.status === "error" ? "danger" : "warn"} dot>{run.status.replace("_", " ")}</Badge>
        {run.outcome ? <Badge tone={OUTCOME_TONE[run.outcome] ?? "neutral"}>{run.outcome}</Badge> : null}
        <Badge tone={run.changesMac ? "warn" : "neutral"}>{run.changesMac ? "changes Mac" : "read-only"}</Badge>
        <span className="t-mono ml-auto">{formatDuration(run.durationMs)}</span>
      </div>

      <section aria-label="Pipeline">
        <h3 className="t-label mb-3">Pipeline</h3>
        <div className="run-card !border-0 !p-0 !shadow-none">
          <PipelineTrack run={run} selected={picked} onSelect={setPicked} panelId={panelId} idPrefix={`drw-${run.taskId}`} />
          {stage ? <StageDetail stage={stage} id={panelId} labelledBy={`drw-${run.taskId}-${stage.key}`} /> : <p className="t-caption mt-3">Select a stage to see what it did.</p>}
        </div>
      </section>

      <section aria-label="Before and after evidence" className="ba">
        <div className="ba-col">
          <h3 className="t-label">Before · what NEXUS had</h3>
          {loading ? <Skeleton className="mt-3 h-12 w-full" /> : t?.context?.length ? (
            <ul className="ba-list">
              {t.context.map((c, i) => (
                <li key={i}><span className="ba-mark ba-before" aria-hidden>·</span><span>{c.label}{c.detail ? <span className="t-mono"> {c.detail}</span> : null}</span></li>
              ))}
            </ul>
          ) : <p className="t-caption mt-3">No context was recorded for this run.</p>}
        </div>
        <div className="ba-col">
          <h3 className="t-label">After · what it verified</h3>
          {loading ? <Skeleton className="mt-3 h-12 w-full" /> : t?.evidence?.length ? (
            <ul className="ba-list">
              {t.evidence.map((e, i) => (
                <li key={i}>
                  <span className="ba-mark ba-after" aria-hidden>✓</span>
                  <span>{e.statement} <span className="t-mono">{e.kind}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="t-caption mt-3">{run.tools.length ? "No verification evidence — the tool declares no success contract." : "Nothing changed, so there is nothing to verify."}</p>}
          {t?.outcome_reason ? <p className="t-caption mt-2">{t.outcome_reason}</p> : null}
        </div>
      </section>

      {run.response ? (
        <section aria-label="Answer">
          <h3 className="t-label mb-2">Answer</h3>
          <p className="t-body !text-[0.875rem] [overflow-wrap:anywhere]">{run.response.replaceAll("**", "").replaceAll("`", "")}</p>
        </section>
      ) : null}

      <details className="raw">
        <summary className="t-label cursor-pointer">Events · {run.events.length}</summary>
        <ol className="raw-list mono">
          {run.events.map((e, i) => (
            <li key={i}><span>{clockTime(e.timestamp)}</span><span>{e.type}</span><span className="truncate">{e.tool ?? ""}</span></li>
          ))}
        </ol>
      </details>
    </div>
  );
}
