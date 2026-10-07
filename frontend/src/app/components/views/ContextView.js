"use client";

import { basename, shortenPath } from "@/lib/format";
import { useApp } from "../shell/NexusProvider";
import { Page } from "../shell/Page";
import { KeyRow } from "../ui/extras";
import { Icon } from "../ui/icons";
import { Badge, EmptyState, Skeleton, StatusDot, Terminal } from "../ui/primitives";

/**
 * Context: what NEXUS can see right now, and — below it — the exact bundle
 * the agent would be given. The panel renders the same object the agent
 * receives, so it can't drift from what actually informed an answer.
 */

const SEV = { ERROR: "danger", WARNING: "warn", NOTICE: "idle", INFO: "ok" };

export function ContextView() {
  const { context, observations, hydrated, source, online } = useApp();
  const loading = source === "live" && !hydrated && !context;
  const ws = context?.active_workspace;
  const m = context?.machine;

  return (
    <Page wide title="Context" description="What NEXUS sees on your Mac right now. Gathered through read-only tools, briefly cached, refreshed about every 15 seconds.">
      {loading ? (
        <div className="grid-2"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>
      ) : !context ? (
        <div className="panel"><EmptyState icon={<Icon name="context" size={20} />} title={online === false ? "Backend unreachable" : "No context yet"}>NEXUS can’t say what it sees until it can reach the backend.</EmptyState></div>
      ) : (
        <>
          <div className="grid-2">
            <section className="panel panel-pad">
              <div className="flex items-center gap-2"><h2 className="t-h2">Workspace</h2><Badge tone="accent">intent · {context.intent?.toLowerCase()}</Badge></div>
              {ws ? (
                <dl className="mt-3">
                  <KeyRow k="Project"><strong>{basename(ws.path)}</strong></KeyRow>
                  <KeyRow k="Path"><span className="mono text-[0.75rem]">{shortenPath(ws.path)}</span></KeyRow>
                  <KeyRow k="Branch"><span className="inline-flex items-center gap-2"><StatusDot tone={ws.git_clean ? "ok" : "warn"} /><span className="mono">{ws.git_branch ?? "—"}</span> {ws.git_clean ? "clean" : `· ${ws.changed_files ?? "some"} changes`}</span></KeyRow>
                  <KeyRow k="Types">{ws.project_types.join(", ") || "—"}</KeyRow>
                  <KeyRow k="Verified">{ws.verified ? "yes" : "no"}</KeyRow>
                </dl>
              ) : <p className="t-caption mt-3">No workspace identified yet.</p>}
            </section>

            <section className="panel panel-pad">
              <h2 className="t-h2">Machine</h2>
              {m ? (
                <dl className="mt-3">
                  <KeyRow k="Platform">{m.platform} · {m.architecture}</KeyRow>
                  <KeyRow k="CPUs"><span className="mono">{m.cpu_count}</span></KeyRow>
                  <KeyRow k="Battery">{m.battery_percentage != null ? <span className="mono">{m.battery_percentage}% {m.charging ? "· charging" : "· on battery"}</span> : "—"}</KeyRow>
                  <KeyRow k="Truncated">{context.truncated ? "yes — capped by the context budget" : "no"}</KeyRow>
                </dl>
              ) : <p className="t-caption mt-3">Machine details weren’t needed for the last request.</p>}
            </section>

            <section className="panel panel-pad">
              <div className="flex items-center justify-between"><h2 className="t-h2">Processes</h2><span className="t-mono">{context.processes.length}</span></div>
              {context.processes.length ? (
                <ul className="mt-3 space-y-1">
                  {context.processes.map((p) => (
                    <li key={p.process_id} className="rail-row"><StatusDot tone={p.status === "RUNNING" ? "ok" : "danger"} live={p.status === "RUNNING"} /><span className="flex-1">{p.name}</span><span className="t-mono">{p.port ? `:${p.port}` : p.status.toLowerCase()}</span></li>
                  ))}
                </ul>
              ) : <p className="t-caption mt-3">None.</p>}
            </section>

            <section className="panel panel-pad">
              <div className="flex items-center justify-between"><h2 className="t-h2">Noticed</h2><span className="t-mono">{observations.length}</span></div>
              {observations.length ? (
                <ul className="mt-3 space-y-1">
                  {observations.slice(0, 6).map((o) => (
                    <li key={o.observation_id} className="rail-note"><StatusDot tone={SEV[o.severity] ?? "idle"} label={o.severity.toLowerCase()} /><div><p className="text-[0.8125rem]">{o.title}</p>{o.summary ? <p className="t-caption">{o.summary}</p> : null}</div></li>
                  ))}
                </ul>
              ) : <p className="t-caption mt-3">Nothing needs your attention.</p>}
            </section>
          </div>

          <h2 className="t-h2 mb-3 mt-8">The bundle the agent receives</h2>
          <Terminal title="GET /api/context" className="!rounded-[var(--r-lg)]">
            <pre className="code-pre mono scroll" tabIndex={0}>{JSON.stringify(context, null, 2)}</pre>
          </Terminal>
        </>
      )}
    </Page>
  );
}
