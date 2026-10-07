"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auditRows, riskOf } from "@/lib/runs";
import { relativeTime } from "@/lib/format";
import { useHotkeys } from "@/lib/hotkeys";
import { useApp } from "../shell/NexusProvider";
import { Page } from "../shell/Page";
import { ApprovalCard, RISK } from "../approvals/ApprovalCard";
import { Icon } from "../ui/icons";
import { Badge, EmptyState, Kbd, Table } from "../ui/primitives";

/**
 * The approvals inbox: everything that is waiting on a person.
 *
 * Keyboard-first — J/K (or ↑/↓) move through the queue, A approves, D denies,
 * E narrows the scope — and none of it fires while you're typing. Edit scope
 * denies the call and asks again with your limits; there is no endpoint that
 * edits a call in place, and pretending otherwise would be inventing one.
 */

export function ApprovalsView() {
  const { pending, decide, runs, runById, send, toast } = useApp();
  const router = useRouter();
  const [picked, setPicked] = useState(0);
  const index = Math.min(picked, Math.max(pending.length - 1, 0));
  const current = pending[index];

  useHotkeys({
    j: () => setPicked(Math.min(index + 1, pending.length - 1)),
    k: () => setPicked(Math.max(index - 1, 0)),
    ArrowDown: () => setPicked(Math.min(index + 1, pending.length - 1)),
    ArrowUp: () => setPicked(Math.max(index - 1, 0)),
  }, pending.length > 1);

  const editScope = (request, text) => {
    const run = runById(request.task_id);
    decide(request.request_id, "deny");
    toast({ tone: "neutral", title: "Denied — asking again with your limits", body: text });
    setTimeout(() => {
      send(`${run?.request ?? "Try that again"} — but ${text}`);
      router.push("/dashboard");
    }, 1200);
  };

  const decided = auditRows(runs).filter((r) => r.kind === "approval" && r.decision !== "waiting").slice(0, 12);

  return (
    <Page
      wide
      title="Approvals"
      description="Every action that changes your Mac stops here first. Approval covers one call and is never reused."
      actions={
        <span className="t-caption inline-flex items-center gap-2">
          <Kbd>J</Kbd><Kbd>K</Kbd> move <Kbd>A</Kbd> approve <Kbd>D</Kbd> deny <Kbd>E</Kbd> edit scope
        </span>
      }
    >
      {pending.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<Icon name="approvals" size={20} />}
            title="Nothing is waiting on you"
            action={<Link href="/dashboard" className="btn btn-primary">Go to Command <Icon name="arrow" size={14} className="arrow-nudge" /></Link>}
          >
            Anything that starts a process, runs a command, opens an app or changes memory will stop here before it runs.
          </EmptyState>
        </div>
      ) : (
        <div className="inbox">
          <ul className="inbox-list" aria-label={`${pending.length} pending requests`}>
            {pending.map((p, i) => {
              const risk = RISK[riskOf(p.tool, p.permission)];
              return (
                <li key={p.request_id}>
                  <button type="button" className={`inbox-item ${i === index ? "is-on" : ""}`} aria-current={i === index} onClick={() => setPicked(i)}>
                    <span className="flex items-center gap-2">
                      <Badge tone={risk.tone}>{risk.label}</Badge>
                      <span className="t-mono ml-auto">{relativeTime(p.created_at)}</span>
                    </span>
                    <span className="inbox-title">{p.description}</span>
                    <span className="t-mono">{p.tool}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="min-w-0">
            {current ? <ApprovalCard key={current.request_id} request={current} onDecide={decide} onEditScope={editScope} focus /> : null}
          </div>
        </div>
      )}

      <h2 className="t-h2 mb-3 mt-10">Recently decided</h2>
      <Table
        caption="Recently decided approvals"
        rowKey={(r) => r.id}
        rows={decided}
        empty={<p className="t-caption py-4 text-center">No decisions yet in this history.</p>}
        onRowClick={(r) => router.push(`/dashboard/timeline?run=${encodeURIComponent(r.taskId)}`)}
        columns={[
          { key: "at", label: "When", render: (r) => <span className="t-mono">{r.at ? relativeTime(new Date(r.at).toISOString()) : "—"}</span> },
          { key: "tool", label: "Tool", render: (r) => <span className="mono text-[0.8125rem]">{r.tool}</span> },
          { key: "request", label: "Request", render: (r) => <span className="cell-title">{r.request}</span> },
          { key: "decision", label: "Decision", render: (r) => <Badge tone={r.decision === "approved" ? "ok" : "warn"} dot>{r.decision}</Badge> },
        ]}
      />
    </Page>
  );
}
