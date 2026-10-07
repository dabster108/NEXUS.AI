"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auditRows } from "@/lib/runs";
import { relativeTime } from "@/lib/format";
import { useApp } from "../shell/NexusProvider";
import { Page } from "../shell/Page";
import { Segmented, SearchField } from "../ui/extras";
import { Icon } from "../ui/icons";
import { Badge, EmptyState, Table } from "../ui/primitives";

/**
 * The audit log: every policy decision, approval, tool call and verification,
 * newest first. It is a *projection* of recorded events — this view has no
 * write path, so it cannot be more optimistic than what happened.
 */

const KINDS = [["all", "All"], ["policy", "Policy"], ["approval", "Approvals"], ["tool", "Tool calls"], ["verify", "Verification"]];

const TONE = { allowed: "ok", approved: "ok", succeeded: "ok", success: "ok", asked: "warn", waiting: "warn", denied: "warn", partial_success: "warn", running: "accent", refused: "danger", failed: "danger" };

function download(name, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditView() {
  const { runs, runsLoading } = useApp();
  const router = useRouter();
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");

  const all = useMemo(() => auditRows(runs), [runs]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((r) => (kind === "all" || r.kind === kind) && (!needle || `${r.tool} ${r.request} ${r.decision} ${r.detail}`.toLowerCase().includes(needle)));
  }, [all, kind, q]);

  const exportRows = () => rows.map((r) => ({ at: r.at ? new Date(r.at).toISOString() : null, kind: r.kind, tool: r.tool, tier: r.permission, decision: r.decision, task: r.taskId, request: r.request, detail: r.detail }));

  return (
    <Page
      wide
      title="Audit log"
      description="Every decision NEXUS made or was asked to make, derived from recorded events. Read-only by construction."
      actions={
        <>
          <button type="button" className="btn btn-ghost" disabled={!rows.length} onClick={() => download("nexus-audit.json", "application/json", JSON.stringify(exportRows(), null, 2))}><Icon name="download" size={14} /> JSON</button>
          <button type="button" className="btn btn-ghost" disabled={!rows.length} onClick={() => {
            const data = exportRows();
            const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
            download("nexus-audit.csv", "text/csv", [Object.keys(data[0]).join(","), ...data.map((d) => Object.values(d).map(esc).join(","))].join("\n"));
          }}><Icon name="download" size={14} /> CSV</button>
        </>
      }
    >
      <div className="toolbar">
        <SearchField value={q} onChange={setQ} placeholder="Search tool, request, decision…" label="Search audit log" />
        <Segmented label="Event kind" value={kind} onChange={setKind} options={KINDS.map(([value, label]) => ({ value, label, count: value === "all" ? all.length : all.filter((r) => r.kind === value).length }))} />
      </div>

      <Table
        caption="Audit log"
        dense
        rowKey={(r) => r.id}
        rows={rows}
        onRowClick={(r) => router.push(`/dashboard/timeline?run=${encodeURIComponent(r.taskId)}`)}
        empty={<EmptyState icon={<Icon name="audit" size={20} />} title={runsLoading ? "Loading…" : all.length ? "Nothing matches" : "Nothing recorded yet"}>{all.length ? "Try a different filter." : "Decisions appear here as soon as NEXUS handles a request."}</EmptyState>}
        columns={[
          { key: "at", label: "When", render: (r) => <span className="t-mono whitespace-nowrap" title={r.at ? new Date(r.at).toLocaleString() : ""}>{r.at ? relativeTime(new Date(r.at).toISOString()) : "—"}</span> },
          { key: "kind", label: "Event", render: (r) => <Badge>{r.kind}</Badge> },
          { key: "tool", label: "Tool", render: (r) => <span className="mono text-[0.8125rem]">{r.tool}</span> },
          { key: "tier", label: "Tier", render: (r) => <span className={`chip tier-${r.permission}`}>{r.permission}</span> },
          { key: "decision", label: "Decision", render: (r) => <Badge tone={TONE[r.decision] ?? "neutral"} dot>{r.decision.replace("_", " ")}</Badge> },
          { key: "detail", label: "Detail", render: (r) => <span className="cell-title mono !text-[0.75rem] !max-w-[320px]">{r.detail || r.request}</span> },
        ]}
      />
    </Page>
  );
}
