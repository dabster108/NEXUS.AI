"use client";

import Link from "next/link";
import { basename, relativeTime, shortenPath, summariseValue } from "@/lib/format";
import { useApp } from "../shell/NexusProvider";
import { SuggestionCard } from "../SuggestionCard";
import { Icon } from "../ui/icons";
import { Skeleton, StatusDot } from "../ui/primitives";

/**
 * "What NEXUS understands, and what it noticed" — the live right rail.
 *
 * Not a menu and not a monitor: a short answer to "what is going on?", with a
 * severity dot beside everything that changed. Each section has three honest
 * empty states that are not interchangeable — still reading, can't reach the
 * backend, and read it and there's nothing.
 */

function Section({ title, count, to, children }) {
  return (
    <section className="rail-section">
      <div className="rail-head">
        <h2 className="t-label">{title}</h2>
        {count ? <span className="t-mono">{count}</span> : null}
        {to ? (
          <Link href={to} className="rail-more" aria-label={`Open ${title}`}>
            <Icon name="arrow" size={12} />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }) => <p className="t-caption">{children}</p>;

const SEV = { ERROR: "danger", WARNING: "warn", NOTICE: "idle", INFO: "ok" };

export function CommandRail({ onSend }) {
  const { context, memories, observations, suggestions, hydrated, online, dismiss, acceptSuggestion, dismissSuggestion, source } = useApp();
  const state = source === "demo" ? "ready" : !hydrated ? "loading" : online === false ? "offline" : "ready";
  const ws = context?.active_workspace;
  const processes = context?.processes ?? [];
  const orderedMemories = [...memories].sort((a, b) => Number(Boolean(b.stale)) - Number(Boolean(a.stale))).slice(0, 3);

  return (
    <div className="rail scroll">
      {state === "offline" ? (
        <p className="rail-offline">
          <StatusDot tone="warn" /> Reconnecting — last state NEXUS reported.
        </p>
      ) : null}

      {suggestions.length ? (
        <Section title="Suggested">
          <ul className="space-y-2">
            {suggestions.slice(0, 2).map((s, i) => (
              <SuggestionCard key={s.suggestion_id} suggestion={s} index={i} onAccept={acceptSuggestion} onDismiss={dismissSuggestion} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Understands" to="/dashboard/context">
        {ws ? (
          <div className="rail-card">
            <p className="truncate text-[0.875rem] font-semibold">{basename(ws.path)}</p>
            <p className="t-mono mt-0.5 truncate">{shortenPath(ws.path)}</p>
            {ws.git_branch ? (
              <p className="mt-2 flex items-center gap-2 text-[0.8125rem] text-[var(--ink-2)]">
                <StatusDot tone={ws.git_clean ? "ok" : "warn"} />
                <span className="mono text-[var(--ink)]">{ws.git_branch}</span>
                <span className="text-[var(--ink-4)]">·</span>
                <span>{ws.git_clean ? "clean" : `dirty · ${ws.changed_files ?? "some"} changes`}</span>
              </p>
            ) : null}
          </div>
        ) : state === "loading" ? (
          <div className="space-y-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-3/5" /></div>
        ) : state === "offline" ? (
          <Empty>Not connected, so NEXUS can’t say where you’re working.</Empty>
        ) : (
          <Empty>No workspace identified yet. Mention a project and NEXUS will verify it first.</Empty>
        )}

        {processes.length ? (
          <ul className="mt-2 space-y-px">
            {processes.map((p) => {
              const up = p.status === "RUNNING";
              return (
                <li key={p.process_id} className="rail-row">
                  <StatusDot tone={up ? "ok" : "danger"} live={up} label={p.status.toLowerCase()} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="t-mono">{p.port ? `:${p.port}` : p.status.toLowerCase()}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Section>

      <Section title="Noticed" count={observations.length || null}>
        {observations.length === 0 ? (
          state === "loading" ? <Skeleton className="h-4 w-4/5" /> : state === "offline" ? <Empty>Not connected — NEXUS may have noticed things since.</Empty> : <Empty>Nothing needs your attention.</Empty>
        ) : (
          <ul className="space-y-0.5">
            {observations.slice(0, 5).map((o) => (
              <li key={o.observation_id} className="rail-note reveal">
                <StatusDot tone={SEV[o.severity] ?? "idle"} live={o.severity === "ERROR"} label={o.severity.toLowerCase()} />
                <div className="min-w-0 flex-1">
                  <p className={`text-[0.8125rem] leading-[1.45] ${["ERROR", "WARNING"].includes(o.severity) ? "text-[var(--ink)]" : "text-[var(--ink-2)]"}`}>{o.title}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="t-caption">{relativeTime(o.created_at)}</span>
                    {o.actionable ? (
                      <button type="button" className="reveal-target link-inline" onClick={() => onSend(`Investigate this and tell me what is going on — do not change anything: ${o.title}`)}>
                        Investigate
                      </button>
                    ) : null}
                    <button type="button" className="reveal-target link-inline is-muted" onClick={() => dismiss(o.observation_id)}>Dismiss</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Remembers" count={memories.length || null} to="/dashboard/memory">
        {orderedMemories.length === 0 ? (
          state === "loading" ? <Skeleton className="h-4 w-3/5" /> : <Empty>NEXUS isn’t carrying anything forward yet.</Empty>
        ) : (
          <ul className="space-y-0.5">
            {orderedMemories.map((m) => (
              <li key={m.id} className="rail-note">
                <StatusDot tone={m.stale ? "warn" : "ok"} label={m.stale ? "outdated" : "current"} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[0.8125rem] font-medium">{m.key}</p>
                    <span className="t-caption">{m.stale ? "outdated" : m.confidence_level?.toLowerCase()}</span>
                  </div>
                  <p className="t-mono truncate">{summariseValue(m.value)}</p>
                  {m.conflict ? <p className="mt-0.5 text-[0.75rem] leading-[1.45] text-[var(--warn-ink)]">{m.conflict}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
