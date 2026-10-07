"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clockTime } from "@/lib/format";
import { useHotkeys } from "@/lib/hotkeys";
import { TOOL_EXAMPLES } from "@/lib/tools";
import { useApp } from "../shell/NexusProvider";
import { RunCard } from "../run/RunCard";
import { ApprovalCard } from "../approvals/ApprovalCard";
import { Composer } from "../Composer";
import { OutcomeCard } from "../OutcomeCard";
import { MissionProgress } from "../MissionProgress";
import { CommandRail } from "./CommandRail";
import { Answer } from "../RichText";
import { Drawer } from "../ui/interactive";
import { Icon } from "../ui/icons";
import { Skeleton } from "../ui/primitives";

/**
 * Command: the conversation, with every request drawn as the pipeline it runs.
 *
 * Centre: your message → its live pipeline run card → the answer. A pending
 * approval docks above the composer (A to approve, D to deny) instead of
 * replacing it. Right: what NEXUS understands and noticed. The rail is a
 * sheet below 1280px.
 */

const OPENERS = [
  { label: "the api died again, restart it", hint: "start_process · asks first" },
  ...TOOL_EXAMPLES.slice(0, 3),
];

function Mark() {
  return (
    <span aria-hidden className="mark">
      <Icon name="spark" size={12} />
    </span>
  );
}

function Welcome({ onSend, tools }) {
  const safe = tools.filter((t) => t.permission === "SAFE").length;
  const confirm = tools.filter((t) => t.permission === "CONFIRM").length;
  return (
    <div className="welcome">
      <span aria-hidden className="welcome-mark enter" style={{ "--i": 0 }}>
        <Icon name="spark" size={20} />
      </span>
      <h1 className="enter t-h1 mt-6" style={{ "--i": 1 }}>What would you like to look at?</h1>
      <p className="enter t-lead mt-3 max-w-lg" style={{ "--i": 2 }}>
        I read your workspace, Git state, processes and memory — and I ask before I change anything.
      </p>
      {/* Its own fixed-height line, so the tool count arriving never moves the cards below. */}
      <p className="enter t-mono mt-2 min-h-[1.5rem]" style={{ "--i": 2 }}>
        {tools.length ? `${tools.length} tools connected · ${safe} read-only · ${confirm} stop for you` : "\u00A0"}
      </p>
      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {OPENERS.map((o, i) => (
          <button key={o.label} type="button" onClick={() => onSend(o.label)} style={{ "--i": i + 3 }} className="enter lift opener">
            <span className="block text-[0.875rem] font-medium">{o.label}</span>
            <span className="t-mono mt-1 block">{o.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CommandView() {
  const { messages, busy, runById, outcomes, mission, pending, decide, send, stop, error, tools, events } = useApp();
  const [rail, setRail] = useState(false);
  const endRef = useRef(null);

  // Follow the conversation as it grows and as a run advances.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy, events.length, pending.length]);

  const editScope = (request, text) => {
    const run = runById(request.task_id);
    decide(request.request_id, "deny");
    // The denied task needs a moment to wind down before a new one starts.
    setTimeout(() => send(`${run?.request ?? "Try that again"} — but ${text}`), 1200);
  };

  const first = pending[0];

  useHotkeys({ "/": () => document.getElementById("composer-input")?.focus() });

  return (
    <div className="cmd">
      <div className="cmd-main">
        <div className="cmd-strip">
          <button type="button" className="btn btn-ghost btn-sm xl-hide" onClick={() => setRail(true)}>
            <Icon name="context" size={14} /> What NEXUS understands
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="flex-1 overflow-hidden"><Welcome onSend={send} tools={tools} /></div>
        ) : (
          <div className="scroll flex-1" role="log" aria-live="polite" aria-label="Conversation">
            <div className="transcript">
              {messages.map((m, i) => {
                if (m.role === "user") {
                  const run = m.taskId ? runById(m.taskId) : null;
                  return (
                    <div key={`u${i}`} className="turn">
                      <div className="enter flex flex-col items-end gap-1">
                        <div className="bubble-user">{m.text}</div>
                        <span className="t-mono px-1">{clockTime(m.at)}</span>
                      </div>
                      {run ? <RunCard run={run} /> : m.taskId || (busy && i === messages.length - 1) ? <div className="run-card"><Skeleton className="h-3 w-1/3" /><Skeleton className="mt-4 h-8 w-full" /></div> : null}
                    </div>
                  );
                }
                const forTurn = outcomes[m.taskId] ?? [];
                return (
                  <div key={`n${i}`} className="turn enter flex gap-3">
                    <Mark />
                    <div className="min-w-0 flex-1">
                      <div className="answer"><Answer text={m.text} /></div>
                      {mission?.taskId === m.taskId ? <div className="mt-4 max-w-[68ch]"><MissionProgress mission={mission} /></div> : null}
                      {forTurn.length ? (
                        <div className="mt-3.5 max-w-[68ch] space-y-2">
                          {forTurn.map((v, j) => <OutcomeCard key={j} verification={v} onSend={send} />)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          </div>
        )}

        {error ? <p role="alert" className="cmd-error enter-sm">{error}</p> : null}

        {first ? (
          <div className="dock">
            <ApprovalCard request={first} onDecide={decide} onEditScope={editScope} focus compact />
            {pending.length > 1 ? (
              <p className="dock-more t-caption">
                {pending.length - 1} more waiting · <Link href="/dashboard/approvals" className="link-inline">open the inbox</Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <Composer busy={busy} onSend={send} onStop={stop} />
      </div>

      <aside className="cmd-rail" aria-label="What NEXUS understands and noticed">
        <CommandRail onSend={send} />
      </aside>

      <Drawer open={rail} onClose={() => setRail(false)} title="What NEXUS understands" width={360}>
        <CommandRail onSend={(t) => { send(t); setRail(false); }} />
      </Drawer>
    </div>
  );
}
