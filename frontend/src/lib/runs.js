/**
 * Turns one task's events into the nine-stage run the dashboard draws.
 *
 * A pure function of the same ExecutionEvents the WebSocket already carries
 * (backend/app/agent/events.py) — nothing is invented. Where the backend does
 * not record a thing, the stage says so instead of filling the gap:
 *
 *   • SAFE tool arguments are not in any event (events "never carry tool
 *     argument values"), so the macOS stage shows arguments only when they came
 *     from an approval request, where the backend does expose them.
 *   • Intent and Policy have no start/end events of their own; their timing is
 *     bounded by the events either side, and labelled as such.
 *
 * `events` is the task's event log, oldest first. `approvals` is optional and
 * maps request_id → { arguments, description } for requests we know about.
 */

import { STAGES } from "./pipeline";

const RISK_HIGH = new Set(["run_command", "stop_process", "delete_memory"]);
const RISK_LOW = new Set(["open_application"]);

/** low | medium | high — a presentation of the tier, never a new permission. */
export function riskOf(tool, permission) {
  if (permission === "RESTRICTED") return "high";
  if (RISK_HIGH.has(tool)) return "high";
  if (RISK_LOW.has(tool)) return "low";
  return permission === "CONFIRM" ? "medium" : "low";
}

const ms = (iso) => {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : null;
};

const span = (a, b) => (a != null && b != null && b >= a ? b - a : null);

export function formatDuration(value) {
  if (value == null) return "—";
  if (value < 1) return "<1ms";
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`;
  return `${Math.floor(value / 60_000)}m ${Math.round((value % 60_000) / 1000)}s`;
}

const CTX_TYPES = ["memory_retrieved", "workspace_detected", "context_collected"];

export function buildRun({
  taskId,
  request = "",
  events = [],
  status,
  response = null,
  createdAt,
  completedAt,
  approvals = {},
}) {
  const ev = events.filter((e) => e && e.type);
  const of = (type) => ev.filter((e) => e.type === type);
  const first = (type) => of(type)[0];

  const started = first("task_started");
  const terminal = ev.find((e) =>
    ["task_completed", "task_error", "task_cancelled"].includes(e.type),
  );
  const t0 = ms(createdAt) ?? ms(started?.timestamp) ?? ms(ev[0]?.timestamp);
  const tEnd = ms(completedAt) ?? ms(terminal?.timestamp);
  const finished =
    Boolean(terminal) || ["completed", "error", "cancelled"].includes(status);
  const active = !finished && ev.length > 0;

  const ctxEvents = ev.filter((e) => CTX_TYPES.includes(e.type));
  const ctxFirst = ms(ctxEvents[0]?.timestamp);
  const ctxDone = first("context_collected");
  const ctxDoneAt = ms(ctxDone?.timestamp);
  const summary = ctxDone?.summary ?? {};

  const requested = of("tool_requested");
  const needed = of("permission_required");
  const startedTools = of("tool_started");
  const completedTools = of("tool_completed");
  const verifyStart = first("verification_started");
  const verifies = of("verification_completed");

  /** Per-tool lifecycle, joined across the events that mention it. */
  const tools = requested.map((r) => {
    const perm = needed.find((n) => n.tool === r.tool);
    const run = startedTools.find((s) => s.tool === r.tool);
    const done = completedTools.find((c) => c.tool === r.tool);
    const approval = perm?.request_id ? approvals[perm.request_id] : undefined;
    const resolved = Boolean(run);
    return {
      tool: r.tool,
      permission: r.permission ?? perm?.permission ?? "SAFE",
      reason: perm?.message ?? null,
      requestId: perm?.request_id ?? null,
      args: approval?.arguments ?? null,
      description: approval?.description ?? null,
      requestedAt: ms(r.timestamp),
      askedAt: ms(perm?.timestamp),
      startedAt: ms(run?.timestamp),
      completedAt: ms(done?.timestamp),
      success: done ? done.success !== false : null,
      resultMessage: done?.message ?? null,
      // Approved = the tool started after being asked about. Denied = it never
      // started once the run is over. Otherwise still waiting.
      decision: !perm ? null : resolved ? "approved" : finished ? "denied" : "waiting",
    };
  });

  const waiting = tools.some((t) => t.decision === "waiting");
  const denied = tools.filter((t) => t.decision === "denied");
  const errored = terminal?.type === "task_error";
  const cancelled = terminal?.type === "task_cancelled";

  const stage = (key, partial) => {
    const base = STAGES.find((s) => s.key === key);
    return { key, title: base.title, file: base.file, tag: base.tag, durationMs: null, summary: "", details: [], ...partial };
  };

  // --- 1 Intent ----------------------------------------------------------------
  const intentEnd = ctxFirst ?? (finished ? tEnd : null);
  const intent = stage("intent", {
    state: !ev.length ? "pending" : intentEnd != null ? "done" : "running",
    durationMs: span(t0, intentEnd),
    summary: summary.intent ? `classified as ${summary.intent}` : "classified by pattern, no model call",
    details: [
      { label: "request", value: request || started?.message || "—" },
      { label: "intent", value: summary.intent ?? "recorded with the context event", mono: true },
      { label: "method", value: "deterministic regex — no model call" },
    ],
  });

  // --- 2 Context ---------------------------------------------------------------
  const context = stage("context", {
    state: ctxDone ? "done" : ctxEvents.length ? "running" : intent.state === "done" && active ? "running" : finished ? "skipped" : "pending",
    durationMs: span(ctxFirst, ctxDoneAt),
    summary: ctxDone
      ? `${summary.memories ?? 0} memories · ${summary.workspaces ?? 0} workspace · ${summary.processes ?? 0} processes`
      : "gathering",
    details: ctxDone
      ? [
          { label: "memories", value: String(summary.memories ?? 0), mono: true },
          { label: "workspaces", value: String(summary.workspaces ?? 0), mono: true },
          { label: "processes", value: String(summary.processes ?? 0), mono: true },
          { label: "recent tasks", value: String(summary.recent_tasks ?? 0), mono: true },
          { label: "observations", value: String(summary.observations ?? 0), mono: true },
          { label: "truncated", value: summary.truncated ? "yes — capped by budget" : "no", mono: true },
          ...of("memory_retrieved").map((m) => ({ label: "memory query", value: `${m.query ?? ""} → ${m.count ?? 0}`, mono: true })),
          ...of("workspace_detected").map((w) => ({ label: "workspace", value: `${w.path}${w.verified ? " (verified)" : " (unverified)"}`, mono: true })),
        ]
      : [],
  });

  // --- 3 Agent -----------------------------------------------------------------
  const agentStart = ctxDoneAt;
  const agentEnd = ms(requested[0]?.timestamp) ?? (finished ? tEnd : null);
  const plan = first("mission_plan_created");
  const agent = stage("agent", {
    state: !ctxDone ? (finished ? "skipped" : "pending") : agentEnd != null ? "done" : "running",
    durationMs: span(agentStart, agentEnd),
    summary: tools.length ? `chose ${tools.map((t) => t.tool).join(", ")}` : agentEnd != null ? "answered without tools" : "reasoning",
    details: [
      ...tools.map((t) => ({ label: "requested", value: t.tool, mono: true })),
      ...(plan ? [{ label: "mission plan", value: plan.message ?? `${(plan.steps ?? []).length} steps` }] : []),
      ...of("agent_message").slice(0, 1).map((m) => ({ label: "reply", value: m.message ?? "" })),
    ],
  });

  // --- 4 Policy ----------------------------------------------------------------
  const restricted = tools.find((t) => t.permission === "RESTRICTED");
  const policy = stage("policy", {
    state: restricted ? "block" : tools.length ? "done" : agent.state === "done" || finished ? "skipped" : "pending",
    durationMs: null,
    summary: tools.length
      ? tools.map((t) => `${t.tool} → ${t.permission}`).join(" · ")
      : "no tools to classify",
    details: tools.map((t) => ({
      label: t.tool,
      value: `${t.permission} — ${
        t.reason ?? (t.permission === "SAFE" ? "read-only; runs immediately" : t.permission === "RESTRICTED" ? "never runs" : "changes your Mac; needs approval")
      }`,
      tone: t.permission === "SAFE" ? "ok" : t.permission === "CONFIRM" ? "warn" : "danger",
    })),
  });

  // --- 5 Approval --------------------------------------------------------------
  const approval = stage("approval", {
    state: !needed.length
      ? finished || agent.state === "done" ? "skipped" : "pending"
      : waiting ? "block" : "done",
    durationMs: (() => {
      const waits = tools.filter((t) => t.askedAt != null && t.startedAt != null).map((t) => t.startedAt - t.askedAt);
      return waits.length ? waits.reduce((a, b) => a + b, 0) : null;
    })(),
    summary: !needed.length
      ? "not needed — every tool was SAFE"
      : waiting
        ? "waiting for you"
        : denied.length
          ? `denied ${denied.map((t) => t.tool).join(", ")}`
          : "approved · this call only",
    details: tools
      .filter((t) => t.decision)
      .flatMap((t) => [
        { label: t.tool, value: t.decision === "waiting" ? "waiting for a decision" : t.decision, tone: t.decision === "approved" ? "ok" : t.decision === "denied" ? "warn" : "warn" },
        ...(t.requestId ? [{ label: "request", value: t.requestId, mono: true }] : []),
      ]),
  });

  // --- 6 MCP / 7 macOS ---------------------------------------------------------
  const ran = tools.filter((t) => t.startedAt != null);
  const anyRunning = ran.some((t) => t.completedAt == null);
  const anyFailed = ran.some((t) => t.success === false);
  const toolMs = ran.filter((t) => t.completedAt != null).reduce((a, t) => a + (t.completedAt - t.startedAt), 0);
  const execState = !ran.length
    ? waiting ? "pending" : finished || denied.length ? "skipped" : "pending"
    : anyRunning ? "running" : anyFailed ? "failed" : "done";
  const mcp = stage("mcp", {
    state: execState,
    durationMs: ran.length && !anyRunning ? toolMs : null,
    summary: ran.length ? `${ran.length} call${ran.length > 1 ? "s" : ""} over stdio` : "no tool calls",
    details: ran.flatMap((t) => [
      { label: "tools/call", value: t.tool, mono: true },
      ...(t.args ? [{ label: "arguments", value: JSON.stringify(t.args), mono: true }] : [{ label: "arguments", value: "not recorded for this tier", muted: true }]),
    ]),
  });
  const mac = stage("mac", {
    state: execState,
    durationMs: mcp.durationMs,
    summary: ran.length ? ran.map((t) => t.resultMessage ?? t.tool).join(" · ") : "nothing ran",
    details: ran.flatMap((t) => [
      ...(t.description ? [{ label: "action", value: t.description }] : []),
      ...(t.args?.command ? [{ label: "command", value: String(t.args.command), mono: true }] : []),
      ...(t.args?.application ? [{ label: "application", value: String(t.args.application), mono: true }] : []),
      { label: "result", value: t.success == null ? "running" : t.success ? "succeeded" : "failed", tone: t.success === false ? "danger" : t.success ? "ok" : undefined },
    ]),
  });

  // --- 8 Verify ----------------------------------------------------------------
  const verifiedAt = ms(verifies.at(-1)?.timestamp);
  const verify = stage("verify", {
    state: verifies.length ? "done" : verifyStart ? "running" : finished || execState === "skipped" ? "skipped" : "pending",
    durationMs: verifies.length
      ? verifies.reduce((a, v) => a + (Number(v.duration_ms) || 0), 0) || span(ms(verifyStart?.timestamp), verifiedAt)
      : null,
    summary: verifies.length ? verifies.map((v) => v.outcome).join(" · ") : verifyStart ? "re-checking with SAFE tools" : finished ? "no verification contract" : "after the tool returns",
    details: verifies.flatMap((v) => [
      { label: v.tool, value: v.outcome, tone: v.outcome === "SUCCESS" ? "ok" : v.outcome === "FAILED" ? "danger" : "warn", mono: true },
      ...(v.evidence ?? []).map((line) => ({ label: "evidence", value: line })),
      ...(v.unknowns ?? []).map((line) => ({ label: "unknown", value: line, muted: true })),
    ]),
  });

  // --- 9 Outcome ---------------------------------------------------------------
  const outcomeLabel = verifies.at(-1)?.outcome ?? null;
  const outcome = stage("outcome", {
    state: errored ? "failed" : cancelled ? "skipped" : terminal || finished ? "done" : "pending",
    durationMs: span(t0, tEnd),
    summary: errored ? terminal?.message ?? "task failed" : cancelled ? "cancelled" : outcomeLabel ?? (finished ? "answered" : "…"),
    details: [
      ...(outcomeLabel ? [{ label: "outcome", value: outcomeLabel, tone: outcomeLabel === "SUCCESS" ? "ok" : outcomeLabel === "FAILED" ? "danger" : "warn", mono: true }] : []),
      ...(errored ? [{ label: "error", value: terminal?.message ?? "", tone: "danger" }] : []),
      ...(response ? [{ label: "answer", value: response }] : []),
    ],
  });

  const stages = [intent, context, agent, policy, approval, mcp, mac, verify, outcome];

  return {
    taskId,
    request: request || started?.message || "",
    status: waiting ? "awaiting_approval" : finished ? (errored ? "error" : cancelled ? "cancelled" : "completed") : "running",
    startedAt: t0,
    endedAt: tEnd,
    durationMs: span(t0, tEnd),
    stages,
    tools,
    outcome: outcomeLabel,
    response,
    activeKey: stages.find((s) => s.state === "running" || s.state === "block")?.key ?? null,
    changesMac: tools.some((t) => t.permission === "CONFIRM"),
    events: ev,
  };
}

/** One-line description of where a run is, for lists and toasts. */
export function describeRun(run) {
  if (run.status === "awaiting_approval") return "Waiting for your approval";
  if (run.status === "running") {
    const s = run.stages.find((x) => x.key === run.activeKey);
    return s ? `${s.title}…` : "Working";
  }
  if (run.status === "error") return "Failed";
  if (run.status === "cancelled") return "Cancelled";
  if (!run.outcome && run.tools.some((t) => t.decision === "denied")) return "Denied by you";
  return run.outcome ? run.outcome.replaceAll("_", " ").toLowerCase() : "Completed";
}

/** Group a flat event list by task id, preserving order. */
export function groupEvents(events) {
  const map = new Map();
  for (const e of events) {
    if (!e.task_id) continue;
    if (!map.has(e.task_id)) map.set(e.task_id, []);
    map.get(e.task_id).push(e);
  }
  return map;
}

/** Audit rows: every policy decision, approval and tool call, newest first. */
export function auditRows(runs) {
  const rows = [];
  for (const run of runs) {
    for (const t of run.tools) {
      rows.push({
        id: `${run.taskId}:${t.tool}:policy`,
        at: t.requestedAt ?? run.startedAt,
        taskId: run.taskId,
        request: run.request,
        kind: "policy",
        tool: t.tool,
        permission: t.permission,
        decision: t.permission === "SAFE" ? "allowed" : t.permission === "RESTRICTED" ? "refused" : "asked",
        detail: t.reason ?? (t.permission === "SAFE" ? "read-only; runs immediately" : ""),
      });
      if (t.decision) {
        rows.push({
          id: `${run.taskId}:${t.tool}:approval`,
          at: t.startedAt ?? t.askedAt ?? run.startedAt,
          taskId: run.taskId,
          request: run.request,
          kind: "approval",
          tool: t.tool,
          permission: t.permission,
          decision: t.decision,
          detail: t.args ? JSON.stringify(t.args) : "this call only",
        });
      }
      if (t.startedAt != null) {
        rows.push({
          id: `${run.taskId}:${t.tool}:tool`,
          at: t.completedAt ?? t.startedAt,
          taskId: run.taskId,
          request: run.request,
          kind: "tool",
          tool: t.tool,
          permission: t.permission,
          decision: t.success == null ? "running" : t.success ? "succeeded" : "failed",
          detail: t.resultMessage ?? "",
        });
      }
    }
    const verify = run.stages.find((s) => s.key === "verify");
    if (verify?.state === "done") {
      rows.push({
        id: `${run.taskId}:verify`,
        at: run.endedAt ?? run.startedAt,
        taskId: run.taskId,
        request: run.request,
        kind: "verify",
        tool: verify.details[0]?.label ?? "",
        permission: "SAFE",
        decision: (run.outcome ?? "").toLowerCase(),
        detail: verify.details.find((d) => d.label === "evidence")?.value ?? "",
      });
    }
  }
  return rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}
