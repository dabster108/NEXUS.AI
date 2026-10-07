"use client";

import { useState } from "react";
import { riskOf, formatDuration } from "@/lib/runs";
import { shortenPath } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { useHotkeys } from "@/lib/hotkeys";
import { useApp } from "../shell/NexusProvider";
import { Icon } from "../ui/icons";
import { Kbd, Terminal } from "../ui/primitives";

/**
 * One decision, with everything needed to make it.
 *
 * It states what will happen in the backend's own terms and adds nothing —
 * "this is safe" would be the frontend inventing a guarantee the runtime does
 * not make. The weight comes from position, the arguments printed in full, and
 * a preview shaped like the change: a command as a command, a memory edit as a
 * diff. Approval covers this one call and is never reused.
 *
 * Keyboard-first: A approves, D denies, E narrows the scope (the owner of the
 * list wires the keys; the hints here say what they are).
 */

const RISK = {
  low: { label: "Low risk", tone: "ok", note: "Opens something; changes nothing on disk." },
  medium: { label: "Medium risk", tone: "warn", note: "Changes state on your Mac." },
  high: { label: "High risk", tone: "danger", note: "Runs a command or removes something." },
};

function Diff({ lines }) {
  return (
    <pre className="diff mono" aria-label="Change preview">
      {lines.map((l, i) => (
        <span key={i} className={`diff-line diff-${l.kind}`}>
          <span className="diff-sign" aria-hidden>{l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}</span>
          {l.text}
          {"\n"}
        </span>
      ))}
    </pre>
  );
}

const valueText = (v) => (v && typeof v === "object" ? Object.values(v).join(" ") : String(v ?? ""));

/** A preview shaped like the change, from the arguments the backend exposes. */
function Preview({ request, memories, context }) {
  const a = request.arguments ?? {};
  const tool = request.tool;

  if (a.command) {
    return (
      <Terminal title={shortenPath(a.working_directory ?? "~")} className="approval-term">
        <pre className="mono p-3 text-[12px] leading-[1.7]">
          <span className="text-[var(--term-prompt)]">$ </span>
          <span className="text-[var(--term-ink)]">{String(a.command)}</span>
        </pre>
      </Terminal>
    );
  }
  if (tool === "open_application") {
    return (
      <Terminal title="open" className="approval-term">
        <pre className="mono p-3 text-[12px] leading-[1.7]">
          <span className="text-[var(--term-prompt)]">$ </span>
          <span className="text-[var(--term-ink)]">open -a “{String(a.application)}”</span>
        </pre>
      </Terminal>
    );
  }
  if (tool === "save_memory" && a.key) {
    const old = memories.find((m) => m.key === a.key);
    return (
      <Diff
        lines={[
          { kind: "ctx", text: `memory ${a.key}` },
          ...(old ? [{ kind: "del", text: valueText(old.value) }] : []),
          { kind: "add", text: valueText(a.value) },
        ]}
      />
    );
  }
  if (tool === "delete_memory" && a.key) {
    const old = memories.find((m) => m.key === a.key);
    return (
      <Diff
        lines={[
          { kind: "ctx", text: `memory ${a.key}` },
          { kind: "del", text: old ? valueText(old.value) : "(current value)" },
        ]}
      />
    );
  }
  if (tool === "stop_process" && a.process_id) {
    const p = (context?.processes ?? []).find((x) => x.process_id === a.process_id);
    return (
      <Diff
        lines={[
          { kind: "ctx", text: `process ${p?.name ?? a.process_id}${p?.port ? ` :${p.port}` : ""}` },
          { kind: "del", text: "RUNNING" },
          { kind: "add", text: "STOPPED" },
        ]}
      />
    );
  }
  const entries = Object.entries(a);
  return entries.length ? (
    <dl className="arg-list">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd className="mono">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className="t-caption">No arguments.</p>
  );
}

export function ApprovalCard({ request, onDecide, onEditScope, focus = false, hints = true, compact = false }) {
  const { runById, memories, context } = useApp();
  const run = runById(request.task_id);
  const risk = RISK[riskOf(request.tool, request.permission)];
  const now = useNow(true, 1000);
  const waited = Math.max(0, now - Date.parse(request.created_at));
  const [scoping, setScoping] = useState(false);
  const [scope, setScope] = useState("");

  // `focus` marks the request the keys act on (the first one in a list). They
  // never fire while typing, so a decision can't swallow a keystroke.
  useHotkeys(
    {
      a: () => onDecide(request.request_id, "approve"),
      d: () => onDecide(request.request_id, "deny"),
      ...(onEditScope ? { e: () => setScoping(true) } : {}),
    },
    focus && !scoping,
  );

  const policy = run?.tools.find((t) => t.tool === request.tool);

  return (
    <section className={`approval ${compact ? "approval-compact" : ""}`} role="group" aria-labelledby={`ap-${request.request_id}`}>
      <div className="approval-top">
        <span className="approval-eyebrow">
          <span aria-hidden className="dot dot-warn dot-pulse-warn" />
          Approval needed
        </span>
        <span className={`chip chip-${risk.tone}`} title={risk.note}>{risk.label}</span>
        <span className="t-mono ml-auto">{request.tool}</span>
        <span className="t-mono tabular-nums" aria-label="waiting">{formatDuration(waited)}</span>
      </div>

      <h2 id={`ap-${request.request_id}`} className="t-h2 mt-2">{request.description}</h2>
      <p className="t-caption mt-1">
        This changes something on your Mac. NEXUS can’t run it without you, covers this one call only, and won’t ask again if you decline.
      </p>

      <div className="mt-3">
        <Preview request={request} memories={memories} context={context} />
      </div>

      {!compact ? (
        <ul className="evidence">
          {run?.request ? (
            <li><span>You asked</span><p>{run.request}</p></li>
          ) : null}
          <li><span>Policy</span><p>{request.permission} — {policy?.reason ?? "classified by the backend as changing your Mac"}</p></li>
          {context?.active_workspace ? (
            <li><span>Where</span><p className="mono">{shortenPath(context.active_workspace.path)}</p></li>
          ) : null}
        </ul>
      ) : null}

      {scoping ? (
        <form
          className="scope-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!scope.trim()) return;
            onEditScope?.(request, scope.trim());
            setScoping(false);
            setScope("");
          }}
        >
          <label htmlFor={`scope-${request.request_id}`} className="t-caption">
            Deny this call and ask again with your limits — e.g. “only in the backend folder”.
          </label>
          <div className="flex gap-2">
            <input
              id={`scope-${request.request_id}`}
              className="field"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Narrower scope…"
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={!scope.trim()}>Re-ask</button>
            <button type="button" className="btn btn-ghost" onClick={() => setScoping(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="approval-actions">
          <button type="button" className="btn btn-primary btn-lg btn-pulse" onClick={() => onDecide(request.request_id, "approve")}>
            <Icon name="check" /> Approve {hints ? <Kbd>A</Kbd> : null}
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => onDecide(request.request_id, "deny")}>
            Deny {hints ? <Kbd>D</Kbd> : null}
          </button>
          {onEditScope ? (
            <button type="button" className="btn btn-quiet" onClick={() => setScoping(true)}>
              <Icon name="edit" size={14} /> Edit scope {hints ? <Kbd>E</Kbd> : null}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** Exposed so the owner of a list can drive the "E" key. */
export { RISK };
