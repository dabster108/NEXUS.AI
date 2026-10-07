"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { describeRun, formatDuration } from "@/lib/runs";
import { relativeTime } from "@/lib/format";
import { useApp } from "../shell/NexusProvider";
import { Page } from "../shell/Page";
import { RunDetail } from "./RunDetail";
import { Drawer } from "../ui/interactive";
import { Segmented, SearchField } from "../ui/extras";
import { Icon } from "../ui/icons";
import { Badge, EmptyState, ErrorState, Skeleton, Table } from "../ui/primitives";

/**
 * Timeline: every run NEXUS has handled, filterable and searchable. Choosing
 * one opens its full pipeline, with before/after evidence, in a drawer that
 * is deep-linkable (?run=<task id>) so a run can be shared by URL.
 */

const STATUS_FILTERS = [
  ["all", "All"],
  ["awaiting_approval", "Waiting"],
  ["completed", "Completed"],
  ["error", "Failed"],
  ["cancelled", "Cancelled"],
];

const OUTCOME_TONE = { SUCCESS: "ok", PARTIAL_SUCCESS: "warn", FAILED: "danger", UNKNOWN: "neutral" };

function Inner() {
  const { runs, runsLoading, runsError, reloadRuns, source } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("run");
  const [status, setStatus] = useState("all");
  const [tier, setTier] = useState("any");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c = { all: runs.length };
    for (const r of runs) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [runs]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return runs.filter((r) => {
      if (status !== "all" && r.status !== status && !(status === "awaiting_approval" && r.status === "running")) return false;
      if (tier === "changes" && !r.changesMac) return false;
      if (tier === "readonly" && r.changesMac) return false;
      if (!needle) return true;
      return [r.request, r.taskId, r.outcome, ...r.tools.map((t) => t.tool)].join(" ").toLowerCase().includes(needle);
    });
  }, [runs, status, tier, q]);

  const open = openId ? runs.find((r) => r.taskId === openId) : null;
  const close = () => router.replace("/dashboard/timeline", { scroll: false });

  return (
    <Page
      wide
      title="Timeline"
      description="Every request NEXUS has handled, with the evidence for what it did."
      actions={<button type="button" className="btn btn-ghost" onClick={reloadRuns}><Icon name="restart" size={14} /> Reload</button>}
    >
      <div className="toolbar">
        <SearchField value={q} onChange={setQ} placeholder="Search requests, tools, ids…" label="Search runs" />
        <Segmented
          label="Status"
          value={status}
          onChange={setStatus}
          options={STATUS_FILTERS.map(([value, label]) => ({ value, label, count: value === "all" ? counts.all : counts[value] ?? 0 }))}
        />
        <Segmented
          label="Tier"
          value={tier}
          onChange={setTier}
          options={[{ value: "any", label: "Any" }, { value: "changes", label: "Changes Mac" }, { value: "readonly", label: "Read-only" }]}
        />
      </div>

      {runsError && !runs.length ? (
        <div className="panel">
          <ErrorState title="Couldn’t load history" action={<button type="button" className="btn btn-primary" onClick={reloadRuns}>Try again</button>}>
            {runsError}
          </ErrorState>
        </div>
      ) : runsLoading && !runs.length ? (
        <div className="panel skeleton-rows" aria-busy="true" aria-label="Loading runs">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      ) : (
        <Table
          caption="Runs"
          rowKey={(r) => r.taskId}
          rows={rows}
          onRowClick={(r) => router.push(`/dashboard/timeline?run=${encodeURIComponent(r.taskId)}`, { scroll: false })}
          empty={
            <EmptyState icon={<Icon name="timeline" size={20} />} title={runs.length ? "No runs match" : "No runs yet"}>
              {runs.length ? "Try a different filter or search." : source === "demo" ? "Ask something in Command and it will appear here." : "Ask something in Command — every request is recorded here."}
            </EmptyState>
          }
          columns={[
            { key: "when", label: "When", render: (r) => <span className="t-mono whitespace-nowrap">{r.startedAt ? relativeTime(new Date(r.startedAt).toISOString()) : "—"}</span> },
            { key: "request", label: "Request", render: (r) => <span><span className="cell-title block">{r.request || r.taskId}</span><span className="cell-sub mono">{r.tools.map((t) => t.tool).join(" · ") || "no tools"}</span></span> },
            { key: "tier", label: "Tier", render: (r) => <Badge tone={r.changesMac ? "warn" : "neutral"}>{r.changesMac ? "changes Mac" : "read-only"}</Badge> },
            { key: "outcome", label: "Outcome", render: (r) => r.outcome ? <Badge tone={OUTCOME_TONE[r.outcome] ?? "neutral"}>{r.outcome.replace("_", " ")}</Badge> : r.tools.some((t) => t.decision === "denied") ? <Badge tone="warn">denied</Badge> : <span className="t-caption">{describeRun(r)}</span> },
            { key: "duration", label: "Duration", align: "right", render: (r) => <span className="t-mono">{formatDuration(r.durationMs)}</span> },
            { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "completed" ? "ok" : r.status === "error" ? "danger" : r.status === "cancelled" ? "neutral" : "warn"} dot>{r.status.replace("_", " ")}</Badge> },
          ]}
        />
      )}

      <Drawer open={Boolean(open)} onClose={close} title={open?.request || "Run"} subtitle={open?.taskId} width={620}>
        {open ? <RunDetail run={open} /> : null}
      </Drawer>
    </Page>
  );
}

export function TimelineView() {
  // useSearchParams needs a Suspense boundary under static prerendering.
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
