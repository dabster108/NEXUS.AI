"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { groupTools, permissionHint, toolLabel } from "@/lib/tools";
import { relativeTime } from "@/lib/format";
import { useApp } from "../shell/NexusProvider";
import { Page } from "../shell/Page";
import { Drawer } from "../ui/interactive";
import { Segmented, SearchField, Stat, KeyRow } from "../ui/extras";
import { Icon } from "../ui/icons";
import { Badge, EmptyState, Skeleton, StatusDot, Table, Terminal } from "../ui/primitives";

/**
 * The tool registry: what NEXUS can do, and under which permission tier.
 *
 * The tiers are decided by the backend's policy, not declared by the tool —
 * an unclassified tool is RESTRICTED and never runs. Use counts and success
 * rates are derived from the runs this view can see (history + this session),
 * not from a metrics service, and say so.
 */

export function ToolsView() {
  const { tools, mcp, toolStats, runs, hydrated, source } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("all");
  const [openName, setOpenName] = useState(null);

  const category = useMemo(() => {
    const map = {};
    for (const g of groupTools(tools)) for (const t of g.items) map[t.name] = g.label;
    return map;
  }, [tools]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tools.filter((t) => (tier === "all" || t.permission === tier) && (!needle || `${t.name} ${t.description} ${toolLabel(t.name)}`.toLowerCase().includes(needle)));
  }, [tools, q, tier]);

  const count = (p) => tools.filter((t) => t.permission === p).length;
  const server = mcp.find((s) => s.name === "nexus-mac") ?? mcp[0];
  const open = tools.find((t) => t.name === openName);
  const recent = open ? runs.filter((r) => r.tools.some((t) => t.tool === open.name)).slice(0, 5) : [];
  const loading = source === "live" && !hydrated;

  return (
    <Page wide title="Tools (MCP)" description="Capabilities the Mac MCP server advertises, and the permission tier the backend assigns each one.">
      <div className="stat-grid">
        <Stat label="Tools" value={tools.length} sub={server ? `via ${server.name}` : "discovered over MCP"} />
        <Stat label="SAFE" value={count("SAFE")} tone="ok" sub="read-only · run instantly" />
        <Stat label="CONFIRM" value={count("CONFIRM")} tone="warn" sub="stop for you, every time" />
        <Stat label="RESTRICTED" value={count("RESTRICTED")} tone={count("RESTRICTED") ? "danger" : undefined} sub="never run" />
      </div>

      {server ? (
        <p className="panel panel-pad mb-4 flex flex-wrap items-center gap-3 text-[0.8125rem]">
          <StatusDot tone={server.status === "connected" ? "ok" : "danger"} live={server.status === "connected"} />
          <span><strong>{server.name}</strong> is {server.status}</span>
          <span className="t-mono">stdio · no socket</span>
          {server.reason ? <span className="text-[var(--danger-ink)]">{server.reason}</span> : null}
        </p>
      ) : null}

      <div className="toolbar">
        <SearchField value={q} onChange={setQ} placeholder="Search tools…" label="Search tools" />
        <Segmented label="Permission tier" value={tier} onChange={setTier} options={[{ value: "all", label: "All" }, { value: "SAFE", label: "SAFE", count: count("SAFE") }, { value: "CONFIRM", label: "CONFIRM", count: count("CONFIRM") }, { value: "RESTRICTED", label: "RESTRICTED", count: count("RESTRICTED") }]} />
      </div>

      {loading ? (
        <div className="panel skeleton-rows" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : (
        <Table
          caption="Tools"
          dense
          rowKey={(t) => t.name}
          rows={rows}
          onRowClick={(t) => setOpenName(t.name)}
          empty={<EmptyState icon={<Icon name="tools" size={20} />} title={tools.length ? "No tools match" : "No tools reported"}>{tools.length ? "Try a different search or tier." : "The backend hasn’t reported any tools — is the Mac MCP server connected?"}</EmptyState>}
          columns={[
            { key: "name", label: "Tool", render: (t) => <span><span className="mono cell-title !text-[0.8125rem]">{t.name}</span><span className="cell-sub">{toolLabel(t.name)} · {category[t.name] ?? "Other"}</span></span> },
            { key: "tier", label: "Tier", render: (t) => <span className={`chip tier-${t.permission}`} title={permissionHint(t.permission)}>{t.permission}</span> },
            { key: "calls", label: "Calls", align: "right", render: (t) => <span className="mono tabular-nums">{toolStats[t.name]?.calls ?? 0}</span> },
            { key: "rate", label: "Success", align: "right", render: (t) => { const r = toolStats[t.name]?.successRate; return r == null ? <span className="t-caption">—</span> : <span className={`mono tabular-nums ${r < 0.8 ? "tone-warn" : ""}`}>{Math.round(r * 100)}%</span>; } },
            { key: "last", label: "Last used", render: (t) => { const at = toolStats[t.name]?.lastUsedAt; return <span className="t-caption">{at ? relativeTime(new Date(at).toISOString()) : "never"}</span>; } },
          ]}
        />
      )}
      <p className="t-caption mt-3">Calls and success are derived from the {runs.length} run{runs.length === 1 ? "" : "s"} this view can see — not from a metrics service.</p>

      <Drawer open={Boolean(open)} onClose={() => setOpenName(null)} title={open?.name ?? "Tool"} subtitle={open ? toolLabel(open.name) : ""} width={520}>
        {open ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2"><span className={`chip tier-${open.permission}`}>{open.permission}</span><span className="t-caption">{permissionHint(open.permission)}</span></div>
            <p className="t-body !text-[0.875rem]">{open.description}</p>
            <dl>
              <KeyRow k="Source"><span className="mono">{open.source}</span></KeyRow>
              <KeyRow k="Calls">{toolStats[open.name]?.calls ?? 0}</KeyRow>
              <KeyRow k="Success rate">{toolStats[open.name]?.successRate != null ? `${Math.round(toolStats[open.name].successRate * 100)}%` : "—"}</KeyRow>
            </dl>
            <section>
              <h3 className="t-label mb-2">Input schema</h3>
              <Terminal title="inputSchema" className="!rounded-[var(--r)]"><pre className="code-pre mono scroll" tabIndex={0}>{Object.keys(open.input_schema ?? {}).length ? JSON.stringify(open.input_schema, null, 2) : "// the server did not advertise a schema"}</pre></Terminal>
            </section>
            <section>
              <h3 className="t-label mb-2">Recent runs</h3>
              {recent.length ? (
                <ul className="space-y-1">{recent.map((r) => <li key={r.taskId}><button type="button" className="link-inline !text-[0.8125rem] text-left" onClick={() => router.push(`/dashboard/timeline?run=${encodeURIComponent(r.taskId)}`)}>{r.request || r.taskId}</button></li>)}</ul>
              ) : <p className="t-caption">Not used in any run this view can see.</p>}
            </section>
            <Badge tone="neutral">Tiers are set by the backend policy, not by the tool</Badge>
          </div>
        ) : null}
      </Drawer>
    </Page>
  );
}
