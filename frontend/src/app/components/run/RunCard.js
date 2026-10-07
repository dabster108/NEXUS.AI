"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { describeRun, formatDuration } from "@/lib/runs";
import { useNow } from "@/lib/useNow";
import { PipelineTrack, StageDetail } from "./PipelineTrack";
import { Icon } from "../ui/icons";
import { StatusDot } from "../ui/primitives";

/**
 * One request, drawn as the nine stages it passes through.
 *
 * Every request in the Command view gets one. While it runs the active stage
 * is open automatically (so you watch what the system is doing); once it
 * finishes the card collapses to its track, and any node opens its detail:
 * the context bundle, the policy decision and its reason, the tool call, the
 * macOS command, the verification result.
 */

const STATUS_TONE = {
  running: "accent",
  awaiting_approval: "warn",
  completed: "ok",
  error: "danger",
  cancelled: "idle",
};

export function RunCard({ run, linkToTimeline = true }) {
  const panelId = useId();
  const [picked, setPicked] = useState(undefined); // undefined = follow the run; null = closed
  const live = run.status === "running" || run.status === "awaiting_approval";
  const now = useNow(live);

  const selected = picked === undefined ? (live ? run.activeKey : null) : picked;
  const stage = run.stages.find((s) => s.key === selected);
  const elapsed = live ? now - (run.startedAt ?? now) : run.durationMs;

  return (
    <section className={`run-card run-${run.status}`} aria-label={`Pipeline run: ${run.request}`}>
      <header className="run-head">
        <StatusDot tone={STATUS_TONE[run.status] ?? "idle"} live={live} />
        <p className="run-title">
          <span className="font-semibold">Pipeline</span>
          <span className="run-state">{describeRun(run)}</span>
        </p>
        <span className="t-mono ml-auto tabular-nums">{elapsed != null ? formatDuration(Math.max(elapsed, 0)) : ""}</span>
        {run.changesMac ? <span className="chip chip-warn !py-0">changes Mac</span> : <span className="chip !py-0">read-only</span>}
        {linkToTimeline ? (
          <Link href={`/dashboard/timeline?run=${encodeURIComponent(run.taskId)}`} className="btn btn-quiet btn-icon !min-h-6 !min-w-6 !p-1" aria-label="Open in timeline" title="Open in timeline">
            <Icon name="external" size={13} />
          </Link>
        ) : null}
      </header>

      <PipelineTrack run={run} selected={selected} onSelect={setPicked} panelId={panelId} idPrefix={`trk-${run.taskId}`} />

      {stage ? <StageDetail stage={stage} id={panelId} labelledBy={`trk-${run.taskId}-${stage.key}`} /> : null}
      {!stage && !live ? <p className="run-hint t-caption">Select a stage to see what it did.</p> : null}
    </section>
  );
}
