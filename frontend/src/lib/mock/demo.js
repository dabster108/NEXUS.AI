"use client";

/**
 * ══ MOCK ADAPTER — DEMO RUNTIME ═════════════════════════════════════════════
 *
 * A stand-in for `useNexus` that needs no backend. It returns the same shape,
 * and "runs" a request by emitting ExecutionEvents in the real order and with
 * the real payload fields, pausing at CONFIRM tools until the user decides —
 * so the pipeline run card, approvals inbox and audit log behave exactly as
 * they do against the live backend.
 *
 * What it is NOT: a model. Replies are templates chosen by keyword. The UI
 * labels every demo surface "Sample data" so no one mistakes it for a result.
 * ===========================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { makeFixtures } from "./fixtures";

const WORKSPACE = "/Users/dikshanta/Documents/distributed-systems-lab";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString();
let counter = 0;
const nextId = (prefix) => `${prefix}_demo_${Date.now().toString(36)}${(counter += 1)}`;

/** Pick a scripted scenario from the wording of the request. */
function plan(message) {
  const m = message.toLowerCase();
  const open = m.match(/\bopen\s+([a-z0-9 ]{2,24})/);
  // Memory wording wins over process names: "forget the memory frontend_port"
  // is about a fact, not about starting the frontend.
  const aboutMemory = /\b(forget|remember|memory)\b/.test(m);

  if (!aboutMemory && /\b(stop|kill)\b/.test(m)) {
    const name = /frontend/.test(m) ? "frontend" : "backend";
    return {
      intent: "TASK",
      tools: [{
        tool: "stop_process", permission: "CONFIRM", reason: "Stops a process NEXUS manages.",
        description: `Stop the ${name} process`, args: { process_id: `proc_${name}` }, runMs: 400, message: `Stopped ${name}.`,
        verify: { outcome: "SUCCESS", summary: `${name} is no longer running.`, evidence: [`process_status ${name} → EXITED`], ms: 300 },
        effect: { process: `proc_${name}`, status: "EXITED" },
      }],
      reply: `Stopped the **${name}** process.`,
    };
  }
  if (!aboutMemory && /\b(restart|start|died|dead|crash(ed)?|down|boot)\b/.test(m) && !/test|git/.test(m)) {
    const name = /frontend/.test(m) ? "frontend" : "backend";
    const port = name === "frontend" ? 3000 : 8123;
    return {
      intent: "TROUBLESHOOT",
      tools: [{
        tool: "start_process", permission: "CONFIRM",
        reason: "Starts a development process on your Mac.",
        description: `Start the ${name} in distributed-systems-lab`,
        args: { name, command: name === "frontend" ? "npm run dev" : "uv run uvicorn app.main:app --port 8123", working_directory: `${WORKSPACE}/${name}` },
        runMs: 1300, message: `Started ${name} (pid 51044).`,
        verify: { outcome: "SUCCESS", summary: `${name} is running and answering.`, evidence: [`process_status → RUNNING (pid 51044)`, `http://127.0.0.1:${port}/ → 200 OK`], ms: 800 },
        effect: { process: `proc_${name}`, status: "RUNNING" },
      }],
      reply: `The **${name}** on **port ${port}** wasn't running. Restarting it changes your Mac, so I asked first. It's running now (pid 51044) and answered 200.`,
    };
  }
  if (/test/.test(m)) {
    return {
      intent: "TASK",
      tools: [{
        tool: "run_command", permission: "CONFIRM", reason: "Runs a command on your Mac.",
        description: "Run `uv run pytest -q` in backend",
        args: { command: "uv run pytest -q", working_directory: `${WORKSPACE}/backend` },
        runMs: 9000, message: "43 passed.",
        verify: { outcome: "SUCCESS", summary: "The command ran and every test passed.", evidence: ["exit code 0", "43 passed in 8.7s"], ms: 280 },
      }],
      reply: "All **43 tests passed** in 8.7s.",
    };
  }
  if (open) {
    const app = open[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      intent: "TASK",
      tools: [{
        tool: "open_application", permission: "CONFIRM", reason: "Opens an application on your Mac.",
        description: `Open ${app}`, args: { application: app }, runMs: 700, message: `Opened ${app}.`,
        verify: { outcome: "SUCCESS", summary: `${app} is running.`, evidence: [`running_processes includes ${app}`], ms: 400 },
      }],
      reply: `Opened **${app}**.`,
    };
  }
  if (/(forget|delete).*(memory|port|remember)|forget /.test(m)) {
    const key = (m.match(/forget(?: the)?(?: memory)?\s+["'`]?([a-z_]+)["'`]?/) ?? [])[1] ?? "frontend_port";
    return {
      intent: "MEMORY",
      tools: [{
        tool: "delete_memory", permission: "CONFIRM", reason: "Deletes a remembered fact.",
        description: `Forget ${key}`, args: { key }, runMs: 80, message: `Deleted ${key}.`,
        effect: { forget: key },
      }],
      reply: `Forgot **${key}**.`,
    };
  }
  if (/(remember|set memory|update memory)/.test(m)) {
    const key = (m.match(/(?:memory|that)\s+["'`]?([a-z_]+)["'`]?\s+(?:is|=|to)\b/) ?? [])[1] ?? "backend_port";
    const value = (m.match(/\b(?:is|to)\s+["'`]?([\w./:-]+)["'`]?\s*$/) ?? m.match(/=\s*["'`]?([\w./:-]+)/) ?? [])[1] ?? "8123";
    return {
      intent: "MEMORY",
      tools: [{
        tool: "save_memory", permission: "CONFIRM", reason: "Saves a fact to local memory.",
        description: `Remember ${key} = ${value}`, args: { key, value }, runMs: 80, message: `Saved ${key}.`,
        verify: { outcome: "SUCCESS", summary: "The memory reads back.", evidence: [`get_memory ${key} → ${value}`], ms: 120 },
        effect: { remember: { key, value } },
      }],
      reply: `Got it — **${key} = ${value}**.`,
    };
  }
  if (/battery/.test(m)) {
    return { intent: "MACHINE", tools: [{ tool: "battery_status", permission: "SAFE", runMs: 180, message: "Battery 78%." }], reply: "Your battery is at **78%** and not charging." };
  }
  if (/(git|change|diff|commit|branch)/.test(m)) {
    return {
      intent: "ORIENT",
      tools: [
        { tool: "git_status", permission: "SAFE", runMs: 230, message: "4 changed files on dikshanta." },
        { tool: "git_log", permission: "SAFE", runMs: 110, message: "5 commits." },
      ],
      reply: "You're on **dikshanta** with **4 uncommitted files**. The latest commit is `feat(evals): add event contract scoring for memory workflows`.",
    };
  }
  if (/(can you do|capabilit|tools)/.test(m)) {
    return { intent: "GENERAL", tools: [], reply: "I have **25 Mac tools**: 19 read-only ones that run immediately, and 6 that stop for your approval — starting or stopping processes, running a command, saving or deleting memory, and opening an app." };
  }
  return {
    intent: "ORIENT",
    tools: [
      { tool: "detect_workspace", permission: "SAFE", runMs: 140, message: "distributed-systems-lab" },
      { tool: "git_status", permission: "SAFE", runMs: 230, message: "4 changed files." },
    ],
    reply: "You're in **distributed-systems-lab** on branch **dikshanta** with 4 uncommitted files. The backend isn't running; the frontend is on `:3000`. Want me to restart the backend?",
  };
}

/** Same return shape as useNexus, plus the history helpers the views need. */
export function useDemoNexus() {
  const [fx] = useState(() => makeFixtures());
  const [context, setContext] = useState(fx.context);
  const [memories, setMemories] = useState(fx.memories);
  const [observations, setObservations] = useState(fx.observations);
  const [suggestions, setSuggestions] = useState(fx.suggestions);
  const [pending, setPending] = useState([]);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [outcomes, setOutcomes] = useState({});
  const [history, setHistory] = useState(fx.tasks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const token = useRef(0);
  const waiters = useRef({});
  const eventStore = useRef({ ...fx.taskEvents });
  const approvalStore = useRef({ ...fx.approvals });
  const traceStore = useRef({ ...fx.traces });
  const active = useRef(null);

  useEffect(
    () => () => {
      token.current += 1; // abandon any in-flight script on unmount
    },
    [],
  );

  const emit = useCallback((event) => {
    const full = { timestamp: stamp(), ...event };
    (eventStore.current[full.task_id] ??= []).push(full);
    setEvents((c) => [...c, full].slice(-150));
    return full;
  }, []);

  const applyEffect = useCallback((effect) => {
    if (!effect) return;
    if (effect.process) {
      setContext((c) => ({
        ...c,
        processes: c.processes.map((p) => (p.process_id === effect.process ? { ...p, status: effect.status } : p)),
      }));
      setObservations((c) => c.filter((o) => o.related_process_id !== effect.process));
      setSuggestions((c) => c.filter((s) => s.suggested_action?.process_id !== effect.process));
    }
    if (effect.forget) setMemories((c) => c.filter((m) => m.key !== effect.forget));
    if (effect.remember) {
      const { key, value } = effect.remember;
      setMemories((c) => {
        const parsed = /^\d+$/.test(value) ? { port: Number(value) } : { value };
        const row = { id: nextId("mem"), type: "FACT", key, value: parsed, confidence_level: "HIGH", last_verified_at: stamp(), stale: false, conflict: null, reasons: [], created_at: stamp(), updated_at: stamp(), source: "you said so" };
        return [row, ...c.filter((m) => m.key !== key)];
      });
    }
  }, []);

  const run = useCallback(
    async (message, taskId, my) => {
      const alive = () => token.current === my;
      const p = plan(message);
      const ev = (type, extra = {}) => alive() && emit({ type, task_id: taskId, ...extra });

      ev("task_started", { message });
      await sleep(260);
      ev("memory_retrieved", { message: "Found 2 relevant memories.", count: 2, query: message.slice(0, 40) });
      await sleep(220);
      ev("workspace_detected", { message: "Verified workspace.", path: WORKSPACE, verified: true });
      await sleep(380);
      ev("context_collected", { message: "Context gathered for planning.", summary: { memories: 2, workspaces: 1, machine: true, truncated: false, processes: 2, recent_tasks: 3, observations: 3, intent: p.intent } });
      await sleep(900);

      let denied = false;
      for (const tool of p.tools) {
        if (!alive()) return;
        ev("tool_requested", { tool: tool.tool, permission: tool.permission, message: `Requested tool '${tool.tool}'.` });
        await sleep(160);

        if (tool.permission === "CONFIRM") {
          const requestId = nextId("perm");
          approvalStore.current[requestId] = { arguments: tool.args, description: tool.description, tool: tool.tool };
          ev("permission_required", { tool: tool.tool, permission: "CONFIRM", message: tool.reason, request_id: requestId });
          setPending((c) => [...c, { request_id: requestId, task_id: taskId, tool: tool.tool, permission: "CONFIRM", description: tool.description, arguments: tool.args, status: "pending", created_at: stamp(), resolved_at: null }]);
          const decision = await new Promise((resolve) => {
            waiters.current[requestId] = resolve;
          });
          if (!alive()) return;
          if (decision !== "approve") {
            denied = true;
            break;
          }
        }

        ev("tool_started", { tool: tool.tool, message: `Running '${tool.tool}'.` });
        await sleep(tool.runMs ?? 300);
        ev("tool_completed", { tool: tool.tool, success: true, message: tool.message });
        applyEffect(tool.effect);
        if (tool.verify) {
          await sleep(200);
          ev("verification_started", { tool: tool.tool, message: `Checking whether '${tool.tool}' achieved what was asked.` });
          await sleep(tool.verify.ms ?? 600);
          ev("verification_completed", { tool: tool.tool, message: tool.verify.summary, outcome: tool.verify.outcome, evidence: tool.verify.evidence, unknowns: tool.verify.unknowns ?? [], duration_ms: tool.verify.ms ?? 600 });
          setOutcomes((c) => ({
            ...c,
            [taskId]: [...(c[taskId] ?? []), { tool: tool.tool, outcome: tool.verify.outcome, summary: tool.verify.summary, evidence: tool.verify.evidence, unknowns: tool.verify.unknowns ?? [] }],
          }));
        }
        await sleep(300);
      }

      if (!alive()) return;
      const reply = denied ? "Okay — I haven't run it." : p.reply;
      ev("agent_message", { message: reply });
      setMessages((c) => [...c, { role: "nexus", text: reply, taskId, at: stamp() }]);
      await sleep(120);
      ev("task_completed", { message: reply });
      setHistory((c) => [
        { task_id: taskId, status: "completed", request: message, message: reply, created_at: eventStore.current[taskId][0].timestamp, completed_at: stamp(), response: reply },
        ...c,
      ]);
      setBusy(false);
      active.current = null;
    },
    [emit, applyEffect],
  );

  const send = useCallback(
    async (text) => {
      const message = text.trim();
      if (!message || active.current) return;
      setError(null);
      setBusy(true);
      const taskId = nextId("task");
      active.current = taskId;
      token.current += 1;
      const my = token.current;
      setMessages((c) => [...c, { role: "user", text: message, taskId, at: stamp() }]);
      run(message, taskId, my);
    },
    [run],
  );

  const decide = useCallback((requestId, decision) => {
    setPending((c) => c.filter((p) => p.request_id !== requestId));
    waiters.current[requestId]?.(decision);
    delete waiters.current[requestId];
  }, []);

  const stop = useCallback(() => {
    const taskId = active.current;
    if (!taskId) return;
    token.current += 1;
    emit({ type: "task_cancelled", task_id: taskId, message: "The task was cancelled." });
    Object.values(waiters.current).forEach((w) => w("deny"));
    waiters.current = {};
    setPending([]);
    setBusy(false);
    active.current = null;
  }, [emit]);

  const dismiss = useCallback((id) => setObservations((c) => c.filter((o) => o.observation_id !== id)), []);
  const dismissSuggestion = useCallback((id) => setSuggestions((c) => c.filter((s) => s.suggestion_id !== id)), []);
  const acceptSuggestion = useCallback(
    (s) => {
      setSuggestions((c) => c.filter((x) => x.suggestion_id !== s.suggestion_id));
      send(s.suggested_action?.prompt ?? s.title);
    },
    [send],
  );

  const getTaskEvents = useCallback(async (taskId) => eventStore.current[taskId] ?? [], []);
  const getTrace = useCallback(async (taskId) => traceStore.current[taskId] ?? null, []);
  const approvalFor = useCallback(() => approvalStore.current, []);

  return {
    online: true,
    hydrated: true,
    context,
    memories,
    observations,
    suggestions,
    tools: fx.tools,
    pending,
    messages,
    events,
    outcomes,
    mission: null,
    mcp: fx.mcp,
    busy,
    error,
    history,
    send,
    decide,
    dismiss,
    dismissSuggestion,
    acceptSuggestion,
    stop,
    getTaskEvents,
    getTrace,
    approvalFor,
  };
}
