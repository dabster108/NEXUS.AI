"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useNexus } from "@/lib/useNexus";
import { useDemoNexus } from "@/lib/mock/demo";
import { fetchTask, fetchTasks, fetchTrace } from "@/lib/api";
import { buildRun, groupEvents } from "@/lib/runs";
import { usePref } from "@/lib/prefs";

/**
 * One connection to NEXUS for the whole app.
 *
 * Mounted in the dashboard layout, so the WebSocket, the run history and any
 * in-flight approval survive moving between views. It owns three decisions:
 *
 *   1. Which source is on screen — the live backend, or the sample-data
 *      adapter. "auto" (default) shows live data, and falls back to sample data
 *      only while the backend is unreachable, with a visible banner. It returns
 *      to live on its own the moment the backend answers.
 *   2. The run model — every task's events folded into the nine-stage run
 *      (lib/runs.js), for the session and for history.
 *   3. Toasts — transient, and only for things that need a person.
 *
 * Both sources expose the same shape, so views never branch on which it is.
 */

const Ctx = createContext(null);

export function useApp() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useApp must be used inside <NexusProvider>");
  return value;
}

const TERMINAL = ["completed", "error", "cancelled"];
const LOAD_LIMIT = 40;

let toastId = 0;

export function NexusProvider({ children }) {
  const live = useNexus();
  const demo = useDemoNexus();
  const [sourcePref, setSourcePref] = usePref("nexus-data-source", "auto");
  const pathname = usePathname();
  // The Command view already docks the approval, so a toast there is noise.
  const onCommand = pathname === "/dashboard";

  const liveOffline = live.hydrated && live.online === false;
  const source =
    sourcePref === "demo" ? "demo" : sourcePref === "live" ? "live" : liveOffline ? "demo" : "live";
  const nexus = source === "demo" ? demo : live;
  // The demo hook returns a fresh object every render; only its callbacks and
  // state are stable, so depend on those and never on the object itself.
  const { approvalFor, getTrace: demoGetTrace, getTaskEvents: demoGetTaskEvents, history: demoHistory } = demo;

  // --- toasts -------------------------------------------------------------------
  const [toasts, setToasts] = useState([]);
  const dismissToast = useCallback((id) => setToasts((c) => c.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    ({ tone = "neutral", title, body, action, ttl = 6000, requestId }) => {
      toastId += 1;
      const id = toastId;
      setToasts((c) => [...c.slice(-3), { id, tone, title, body, action, requestId }]);
      if (ttl) setTimeout(() => dismissToast(id), ttl);
      return id;
    },
    [dismissToast],
  );

  // --- approvals we have seen (their arguments vanish once answered) -------------
  const approvalCache = useRef({});
  const seenPending = useRef(new Set());
  useEffect(() => {
    for (const p of nexus.pending) {
      approvalCache.current[p.request_id] = {
        arguments: p.arguments,
        description: p.description,
        tool: p.tool,
      };
    }
    const fresh = nexus.pending.filter((p) => !seenPending.current.has(p.request_id));
    if (!fresh.length) return;
    fresh.forEach((p) => seenPending.current.add(p.request_id));
    if (onCommand) return;
    // Deferred so no state is set during the effect body.
    Promise.resolve().then(() =>
      fresh.forEach((p) =>
        toast({
          requestId: p.request_id,
          tone: "warn",
          title: "Approval needed",
          body: p.description,
          action: { label: "Review", href: "/dashboard/approvals" },
          ttl: 9000,
        }),
      ),
    );
  }, [nexus.pending, toast, onCommand]);

  // A toast about a request disappears once that request has been decided.
  useEffect(() => {
    const open = new Set(nexus.pending.map((p) => p.request_id));
    Promise.resolve().then(() =>
      setToasts((c) => (c.some((t) => t.requestId && !open.has(t.requestId)) ? c.filter((t) => !t.requestId || open.has(t.requestId)) : c)),
    );
  }, [nexus.pending]);

  // --- run history --------------------------------------------------------------
  const [loaded, setLoaded] = useState({ runs: [], loading: true, error: null });
  const cache = useRef(new Map());

  const approvalsMap = useCallback(
    () => ({ ...approvalCache.current, ...(source === "demo" ? approvalFor() : {}) }),
    [source, approvalFor],
  );

  const reload = useCallback(async () => {
    try {
      let summaries;
      if (source === "demo") summaries = demoHistory;
      else summaries = (await fetchTasks()).tasks ?? [];
      summaries = summaries.slice(0, LOAD_LIMIT);

      const approvals = approvalsMap();
      const runs = [];
      const queue = [...summaries];
      const worker = async () => {
        while (queue.length) {
          const t = queue.shift();
          const key = `${source}:${t.task_id}`;
          let entry = cache.current.get(key);
          if (!entry || !TERMINAL.includes(entry.status)) {
            let events;
            let status = t.status;
            let response = t.response ?? null;
            if (source === "demo") events = await demoGetTaskEvents(t.task_id);
            else {
              const full = await fetchTask(t.task_id);
              events = full.events ?? [];
              status = full.status;
              response = full.response ?? null;
            }
            entry = { status, events, response };
            cache.current.set(key, entry);
          }
          runs.push(
            buildRun({
              taskId: t.task_id,
              request: t.request,
              events: entry.events,
              status: entry.status,
              response: entry.response,
              createdAt: t.created_at,
              completedAt: t.completed_at,
              approvals,
            }),
          );
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      runs.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
      setLoaded({ runs, loading: false, error: null });
    } catch (err) {
      setLoaded((c) => ({ ...c, loading: false, error: err?.message ?? "Could not load history." }));
    }
  }, [source, demoHistory, demoGetTaskEvents, approvalsMap]);

  const lastEvent = nexus.events.at(-1);
  const settledTask =
    lastEvent && ["task_completed", "task_error", "task_cancelled"].includes(lastEvent.type)
      ? lastEvent.task_id
      : null;
  const ready = source === "demo" || (live.hydrated && live.online);

  useEffect(() => {
    if (!ready) return;
    // Deferred: reload sets state, and effects must not set state synchronously.
    Promise.resolve().then(reload);
  }, [ready, reload, settledTask]);

  // --- session runs: built live from the event stream ---------------------------
  const sessionRuns = useMemo(() => {
    const approvals = { ...approvalCache.current, ...(source === "demo" ? approvalFor() : {}) };
    const grouped = groupEvents(nexus.events);
    const out = [];
    for (const [taskId, events] of grouped) {
      const msg = nexus.messages.find((m) => m.taskId === taskId && m.role === "nexus");
      out.push(
        buildRun({
          taskId,
          request: events.find((e) => e.type === "task_started")?.message ?? "",
          events,
          response: msg?.text ?? null,
          approvals,
        }),
      );
    }
    return out.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  }, [nexus.events, nexus.messages, source, approvalFor]);

  /** Every run we know about: history, with the live session on top. */
  const runs = useMemo(() => {
    const session = new Map(sessionRuns.map((r) => [r.taskId, r]));
    // A run still in flight is better known from the stream than from a poll.
    const merged = [...sessionRuns, ...loaded.runs.filter((r) => !session.has(r.taskId))];
    return merged.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  }, [sessionRuns, loaded.runs]);

  const runById = useCallback((id) => runs.find((r) => r.taskId === id) ?? null, [runs]);

  const getTrace = useCallback(
    async (taskId) => {
      if (source === "demo") return demoGetTrace(taskId);
      try {
        return await fetchTrace(taskId);
      } catch {
        return null;
      }
    },
    [source, demoGetTrace],
  );

  // --- derived ------------------------------------------------------------------
  const toolStats = useMemo(() => {
    const stats = {};
    for (const run of runs) {
      for (const t of run.tools) {
        if (t.startedAt == null) continue;
        const s = (stats[t.tool] ??= { calls: 0, ok: 0, lastUsedAt: 0 });
        s.calls += 1;
        if (t.success) s.ok += 1;
        s.lastUsedAt = Math.max(s.lastUsedAt, t.completedAt ?? t.startedAt ?? 0);
      }
    }
    for (const s of Object.values(stats)) s.successRate = s.calls ? s.ok / s.calls : null;
    return stats;
  }, [runs]);

  const attention = nexus.observations.filter((o) => ["ERROR", "WARNING"].includes(o.severity)).length;

  /**
   * Send a chat message on behalf of a button. Every action in the dashboard
   * that could change something goes this way — through the agent, and so
   * through the approval broker — because the backend deliberately has no
   * direct "restart" or "forget" endpoint.
   */
  const nexusSend = nexus.send;
  const ask = useCallback(
    (text, { title = "Sent to NEXUS", gated = false } = {}) => {
      nexusSend(text);
      toast({
        tone: gated ? "warn" : "neutral",
        title,
        body: gated ? "It will stop for your approval before anything changes." : text,
        action: { label: gated ? "Watch it run" : "Open Command", href: "/dashboard" },
        ttl: 3200,
      });
    },
    [nexusSend, toast],
  );

  const value = {
    ...nexus,
    ask,
    source,
    sourcePref,
    setSourcePref,
    liveOffline,
    liveRaw: live,
    runs,
    runsLoading: loaded.loading && ready,
    runsError: loaded.error,
    reloadRuns: reload,
    runById,
    getTrace,
    toolStats,
    attention,
    toasts,
    toast,
    dismissToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
