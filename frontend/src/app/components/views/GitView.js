"use client";

import { basename, shortenPath } from "@/lib/format";
import { useApp } from "../shell/NexusProvider";
import { Page } from "../shell/Page";
import { Stat } from "../ui/extras";
import { Icon } from "../ui/icons";
import { Badge, EmptyState, Skeleton, StatusDot } from "../ui/primitives";

/**
 * Git & workspace, read from the same context the agent gets. NEXUS has no
 * commit or push tool, so there is no commit or push button — the actions here
 * are all questions, never writes.
 */

export function GitView() {
  const { context, hydrated, source, ask } = useApp();
  const spaces = context?.workspaces?.length ? context.workspaces : context?.active_workspace ? [context.active_workspace] : [];
  const loading = source === "live" && !hydrated && !context;

  return (
    <Page wide title="Git & Workspace" description="The projects NEXUS has verified, and the state of their repositories.">
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : spaces.length === 0 ? (
        <div className="panel">
          <EmptyState icon={<Icon name="git" size={20} />} title="No workspace identified" action={<button type="button" className="btn btn-primary" onClick={() => ask("Continue where I left off", { title: "Looking for your workspace" })}>Ask NEXUS to find it</button>}>
            Mention a project, or ask “continue where I left off”, and NEXUS will verify it before using it.
          </EmptyState>
        </div>
      ) : (
        spaces.map((w) => (
          <section key={w.path} className="mb-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="t-h1 !text-[1.375rem]">{basename(w.path)}</h2>
              {w.active ? <Badge tone="accent">active</Badge> : null}
              <Badge tone={w.verified ? "ok" : "warn"} dot>{w.verified ? "verified" : "unverified"}</Badge>
              <span className="t-mono ml-1">{shortenPath(w.path)}</span>
            </div>

            <div className="stat-grid">
              <Stat label="Branch" value={<span className="mono !text-[1.25rem]">{w.git_branch ?? "—"}</span>} sub={w.is_git_repository ? "git repository" : "not a git repository"} />
              <Stat label="Working tree" value={w.git_clean ? "Clean" : w.git_clean === false ? `${w.changed_files ?? "Some"} changes` : "—"} tone={w.git_clean ? "ok" : w.git_clean === false ? "warn" : undefined} sub={w.git_clean === false ? "uncommitted files" : undefined} />
              <Stat label="Project" value={<span className="!text-[1.125rem]">{w.project_types.join(" · ") || "—"}</span>} sub="detected types" />
            </div>

            <div className="grid-2">
              <div className="panel">
                <div className="panel-head"><h3 className="t-h3">Recent commits</h3><span className="t-mono">{w.recent_commits.length}</span></div>
                {w.recent_commits.length ? (
                  <ol className="commits">
                    {w.recent_commits.map((c) => {
                      const [hash, ...rest] = c.split(" ");
                      return <li key={c}><code className="mono">{hash}</code><span>{rest.join(" ")}</span></li>;
                    })}
                  </ol>
                ) : <p className="t-caption panel-pad">No commits read.</p>}
              </div>

              <div className="panel panel-pad">
                <h3 className="t-h3">Ask about this repository</h3>
                <p className="t-caption mt-1">These are questions, not writes. NEXUS has no commit or push tool.</p>
                <div className="mt-4 grid gap-2">
                  {[
                    ["What changed in git?", "git_status · git_log"],
                    ["Show me the uncommitted changes", "git_diff"],
                    ["Summarise this repository", "repo_overview"],
                  ].map(([q, hint]) => (
                    <button key={q} type="button" className="opener lift" onClick={() => ask(q, { title: q })}>
                      <span className="block text-[0.875rem] font-medium">{q}</span>
                      <span className="t-mono mt-0.5 block">{hint}</span>
                    </button>
                  ))}
                </div>
                {w.git_clean === false ? <p className="callout callout-warn mt-4"><StatusDot tone="warn" /> Branch has {w.changed_files ?? "some"} uncommitted file{w.changed_files === 1 ? "" : "s"}.</p> : null}
              </div>
            </div>
          </section>
        ))
      )}
    </Page>
  );
}
