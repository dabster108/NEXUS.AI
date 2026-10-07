"use client";

import { shortenPath } from "@/lib/format";
import { useApp } from "../shell/NexusProvider";
import { Page } from "../shell/Page";
import { Stat } from "../ui/extras";
import { Icon } from "../ui/icons";
import { Badge, EmptyState, Skeleton, StatusDot } from "../ui/primitives";

/**
 * Processes NEXUS manages, with live health. Every control routes through
 * chat: read-only ones (health, logs) simply run; restart and stop are
 * CONFIRM tools and stop at the approval prompt before anything changes.
 */

export function ProcessesView() {
  const { context, mcp, observations, hydrated, source, ask } = useApp();
  const processes = context?.processes ?? [];
  const up = processes.filter((p) => p.status === "RUNNING").length;
  const mac = mcp.find((s) => s.name === "nexus-mac") ?? mcp[0];
  const loading = source === "live" && !hydrated && !context;

  return (
    <Page wide title="Processes" description="Development processes NEXUS started or can see. Anything that restarts or stops one asks you first.">
      <div className="stat-grid">
        <Stat label="Managed" value={processes.length} sub="processes in context" />
        <Stat label="Running" value={up} tone={up ? "ok" : undefined} sub="answering as expected" />
        <Stat label="Not running" value={processes.length - up} tone={processes.length - up ? "danger" : undefined} sub="exited or stopped" />
        <Stat label="Mac server" value={mac?.status === "connected" ? "Up" : mac ? "Down" : "—"} tone={mac?.status === "connected" ? "ok" : "danger"} sub={mac ? `${mac.tools} tools over stdio` : "not reported"} />
      </div>

      {loading ? (
        <div className="grid-2">{[0, 1].map((i) => <Skeleton key={i} className="h-44 w-full" />)}</div>
      ) : processes.length === 0 ? (
        <div className="panel">
          <EmptyState icon={<Icon name="processes" size={20} />} title="No managed processes" action={<button type="button" className="btn btn-primary" onClick={() => ask("Start the development server for this workspace", { title: "Asking to start a process", gated: true })}>Ask NEXUS to start one</button>}>
            Ask NEXUS to start your dev server and it will appear here with live health.
          </EmptyState>
        </div>
      ) : (
        <div className="grid-2">
          {processes.map((p) => {
            const live = p.status === "RUNNING";
            const issue = observations.find((o) => o.related_process_id === p.process_id && o.severity === "ERROR");
            return (
              <article key={p.process_id} className="panel proc">
                <header className="flex items-start gap-3">
                  <StatusDot tone={live ? "ok" : "danger"} live={live} label={p.status.toLowerCase()} className="!mt-2" />
                  <div className="min-w-0 flex-1">
                    <h2 className="t-h2">{p.name}</h2>
                    <p className="t-mono truncate">{shortenPath(p.working_directory) || "—"}</p>
                  </div>
                  <Badge tone={live ? "ok" : "danger"}>{p.status.toLowerCase()}</Badge>
                </header>

                <dl className="proc-meta">
                  <div><dt>Port</dt><dd className="mono">{p.port ? `:${p.port}` : "—"}</dd></div>
                  <div><dt>Id</dt><dd className="mono">{p.process_id}</dd></div>
                  <div><dt>Health</dt><dd>{live ? "running" : "not running"}{p.port && live ? <span className="t-caption"> · check to confirm it answers</span> : null}</dd></div>
                </dl>

                {issue ? <p className="callout callout-danger"><StatusDot tone="danger" /> {issue.title}{issue.summary ? ` — ${issue.summary}` : ""}</p> : null}

                <div className="proc-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => ask(`Restart the ${p.name} process`, { title: `Asking to restart ${p.name}`, gated: true })}>
                    <Icon name="restart" size={13} /> {live ? "Restart" : "Start"}
                  </button>
                  {live ? (
                    <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => ask(`Stop the ${p.name} process`, { title: `Asking to stop ${p.name}`, gated: true })}>Stop</button>
                  ) : null}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => ask(`Show the recent logs for the ${p.name} process`, { title: `Reading ${p.name} logs` })}>Logs</button>
                  {p.port ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => ask(`Check whether http://127.0.0.1:${p.port} is responding`, { title: `Checking :${p.port}` })}>Check health</button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Page>
  );
}
