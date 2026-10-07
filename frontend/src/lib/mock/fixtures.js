/**
 * ══ MOCK ADAPTER — SAMPLE DATA ══════════════════════════════════════════════
 *
 * Everything in this file is invented sample data. It exists so the dashboard
 * can be demonstrated and developed without the backend, and it is only ever
 * shown when the backend is unreachable (or the user picks "Sample data" in
 * Settings) — always behind a visible "Sample data" marker.
 *
 * It is written in the *exact shapes the real API returns* (see
 * backend/app/api/schemas.py and agent/events.py), so swapping to live data
 * changes nothing downstream. Nothing here is used in marketing copy.
 *
 * @typedef {{ type: string, task_id: string, timestamp: string, message?: string,
 *             tool?: string, [k: string]: unknown }} ExecutionEvent
 * ===========================================================================
 */

const WORKSPACE = "/Users/dikshanta/Documents/distributed-systems-lab";

const iso = (t) => new Date(t).toISOString();

/** 25 tools: 19 SAFE, 6 CONFIRM — the real split. */
const TOOL_DEFS = [
  ["battery_status", "SAFE", "Read battery percentage and charging state."],
  ["system_info", "SAFE", "Platform, architecture and CPU count."],
  ["running_processes", "SAFE", "List running applications."],
  ["detect_workspace", "SAFE", "Find and verify the project you are working in."],
  ["repo_overview", "SAFE", "Summarise a repository: type, layout, entry points."],
  ["git_status", "SAFE", "Branch, cleanliness and changed files."],
  ["git_branch", "SAFE", "The current branch."],
  ["git_log", "SAFE", "Recent commits."],
  ["git_diff", "SAFE", "Uncommitted changes, bounded."],
  ["list_directory", "SAFE", "List a folder inside the workspace."],
  ["search_files", "SAFE", "Search file names and contents inside the workspace."],
  ["read_file", "SAFE", "Read a file (secret files are refused)."],
  ["list_processes", "SAFE", "Processes NEXUS started and manages."],
  ["process_status", "SAFE", "Status of one managed process."],
  ["process_logs", "SAFE", "Recent output of a managed process."],
  ["check_local_service", "SAFE", "Probe a localhost URL."],
  ["list_memories", "SAFE", "List what NEXUS remembers."],
  ["get_memory", "SAFE", "Recall one remembered fact."],
  ["verify_memory", "SAFE", "Check a memory against live evidence."],
  ["start_process", "CONFIRM", "Start a development process in a workspace."],
  ["stop_process", "CONFIRM", "Stop a managed process."],
  ["run_command", "CONFIRM", "Run an allow-listed command (no pipes, no shells)."],
  ["save_memory", "CONFIRM", "Remember a fact."],
  ["delete_memory", "CONFIRM", "Forget a remembered fact."],
  ["open_application", "CONFIRM", "Open an installed macOS application by name."],
];

/**
 * One historical run. Timestamps are generated relative to `t0` so the sample
 * always looks recent. `tools[i].approve: false` is a denial.
 */
function runEvents({ id, t0, request, intent = "ORIENT", ctx = {}, tools = [], reply, error }) {
  const e = [];
  let t = t0;
  const push = (type, extra = {}, dt = 0) => {
    t += dt;
    e.push({ type, task_id: id, timestamp: iso(t), ...extra });
  };
  push("task_started", { message: request });
  push("memory_retrieved", { message: "Found memories.", count: ctx.memories ?? 2, query: request.slice(0, 40) }, 60);
  push("workspace_detected", { message: "Verified workspace.", path: WORKSPACE, verified: true }, 140);
  push(
    "context_collected",
    { message: "Context gathered for planning.", summary: { memories: 2, workspaces: 1, machine: true, truncated: false, processes: 2, recent_tasks: 3, observations: 2, intent, ...ctx } },
    220,
  );
  for (const tool of tools) {
    push("tool_requested", { tool: tool.tool, permission: tool.permission, message: `Requested tool '${tool.tool}'.` }, 900);
    if (tool.permission === "CONFIRM") {
      push("permission_required", { tool: tool.tool, permission: "CONFIRM", message: tool.reason, request_id: tool.requestId }, 10);
      if (tool.approve === false) continue;
      t += tool.waitMs ?? 6200;
    }
    push("tool_started", { tool: tool.tool, message: `Running '${tool.tool}'.` }, 40);
    push("tool_completed", { tool: tool.tool, success: tool.success !== false, message: tool.message }, tool.runMs ?? 420);
    if (tool.verify) {
      push("verification_started", { tool: tool.tool, message: `Checking whether '${tool.tool}' achieved what was asked.` }, 30);
      push(
        "verification_completed",
        { tool: tool.tool, message: tool.verify.summary, outcome: tool.verify.outcome, evidence: tool.verify.evidence, unknowns: tool.verify.unknowns ?? [], duration_ms: tool.verify.ms ?? 640 },
        tool.verify.ms ?? 640,
      );
    }
  }
  if (error) push("task_error", { message: error.message, code: error.code }, 300);
  else {
    push("agent_message", { message: reply }, 500);
    push("task_completed", { message: reply }, 20);
  }
  return e;
}

/** @returns the whole sample world, with times relative to `now`. */
export function makeFixtures(now = Date.now()) {
  const min = 60_000;
  const hour = 60 * min;

  const specs = [
    {
      id: "task_sample_restart",
      at: now - 14 * min,
      request: "the api died again, restart it",
      intent: "TROUBLESHOOT",
      tools: [
        {
          tool: "start_process", permission: "CONFIRM", requestId: "perm_sample_01",
          reason: "Starts a development process on your Mac.",
          args: { name: "backend", command: "uv run uvicorn app.main:app --port 8123", working_directory: WORKSPACE },
          description: "Start the backend in distributed-systems-lab",
          waitMs: 5400, runMs: 1300, message: "Started backend (pid 48211).",
          verify: { outcome: "SUCCESS", summary: "Backend is running and answering.", evidence: ["process_status → RUNNING (pid 48211)", "http://127.0.0.1:8123/health → 200 OK"], ms: 810 },
        },
      ],
      reply: "I restarted the backend on **port 8123**. It's running (pid 48211) and `/health` answered 200, so it's back.",
      before: ["backend · EXITED (code 143)", "port 8123 · nothing listening", "memory: backend_port = 8123"],
    },
    {
      id: "task_sample_battery",
      at: now - 41 * min,
      request: "what's my battery at?",
      intent: "MACHINE",
      tools: [{ tool: "battery_status", permission: "SAFE", message: "Battery 78%, not charging.", runMs: 180 }],
      reply: "Your battery is at **78%** and not charging.",
      before: ["machine · macOS arm64"],
    },
    {
      id: "task_sample_git",
      at: now - 62 * min,
      request: "what changed in git?",
      intent: "ORIENT",
      tools: [
        { tool: "git_status", permission: "SAFE", message: "4 changed files on dikshanta.", runMs: 230 },
        { tool: "git_log", permission: "SAFE", message: "5 commits.", runMs: 120 },
      ],
      reply: "You're on **dikshanta** with **4 uncommitted files**. The last commit was `feat(evals): add event contract scoring`.",
      before: ["workspace · distributed-systems-lab", "branch · dikshanta"],
    },
    {
      id: "task_sample_tests",
      at: now - 2.2 * hour,
      request: "run the backend tests",
      intent: "TASK",
      tools: [
        {
          tool: "run_command", permission: "CONFIRM", requestId: "perm_sample_02",
          reason: "Runs a command on your Mac.",
          args: { command: "uv run pytest -q", working_directory: `${WORKSPACE}/backend` },
          description: "Run `uv run pytest -q` in backend",
          waitMs: 9000, runMs: 14200, message: "41 passed, 2 failed.",
          verify: { outcome: "PARTIAL_SUCCESS", summary: "The command ran but 2 tests failed.", evidence: ["exit code 1", "41 passed, 2 failed in 13.9s"], unknowns: ["whether the failures are new"], ms: 300 },
        },
      ],
      reply: "The suite ran: **41 passed, 2 failed**. Both failures are in `tests/test_trace.py`. Want me to read them?",
      before: ["workspace · backend", "test command · uv run pytest (memory)"],
    },
    {
      id: "task_sample_deny",
      at: now - 3.1 * hour,
      request: "open Safari",
      intent: "TASK",
      tools: [
        { tool: "open_application", permission: "CONFIRM", requestId: "perm_sample_03", reason: "Opens an application on your Mac.", args: { application: "Safari" }, description: "Open Safari", approve: false },
      ],
      reply: "Okay — I haven't opened Safari.",
      before: ["no workspace needed"],
    },
    {
      id: "task_sample_stop",
      at: now - 26 * hour,
      request: "kill the frontend dev server",
      intent: "TASK",
      tools: [
        {
          tool: "stop_process", permission: "CONFIRM", requestId: "perm_sample_04",
          reason: "Stops a process NEXUS manages.", args: { process_id: "proc_frontend" },
          description: "Stop the frontend dev server", waitMs: 3000, runMs: 90, success: false, message: "Process not found.",
        },
      ],
      error: { code: "TOOL_ERROR", message: "stop_process failed: Process not found." },
      before: ["frontend · RUNNING :3000"],
    },
    {
      id: "task_sample_remember",
      at: now - 27 * hour,
      request: "remember that the backend port is 8123",
      intent: "MEMORY",
      tools: [
        {
          tool: "save_memory", permission: "CONFIRM", requestId: "perm_sample_05",
          reason: "Saves a fact to local memory.", args: { key: "backend_port", value: { port: 8123 } },
          description: "Remember backend_port = 8123", waitMs: 2400, runMs: 60, message: "Saved backend_port.",
          verify: { outcome: "SUCCESS", summary: "The memory reads back.", evidence: ["get_memory backend_port → { port: 8123 }"], ms: 120 },
        },
      ],
      reply: "Got it — I'll remember **backend port = 8123**.",
      before: ["memory · no backend_port"],
    },
  ];

  const taskEvents = {};
  const tasks = [];
  const traces = {};
  const approvals = {};

  for (const s of specs) {
    const events = runEvents({ id: s.id, t0: s.at, request: s.request, intent: s.intent, tools: s.tools, reply: s.reply, error: s.error });
    taskEvents[s.id] = events;
    const last = events.at(-1);
    tasks.push({
      task_id: s.id,
      status: last.type === "task_error" ? "error" : "completed",
      request: s.request,
      message: s.reply ?? s.error?.message ?? null,
      created_at: events[0].timestamp,
      completed_at: last.timestamp,
      response: s.reply ?? null,
    });
    for (const t of s.tools) {
      if (t.requestId) approvals[t.requestId] = { arguments: t.args, description: t.description, tool: t.tool };
    }
    const verifies = events.filter((x) => x.type === "verification_completed");
    traces[s.id] = {
      task_id: s.id,
      request: s.request,
      status: tasks.at(-1).status,
      summary: s.reply ? s.reply.replaceAll("**", "").replaceAll("`", "") : s.error?.message ?? "",
      context: s.before.map((label) => ({ kind: "context", label, provided: true, detail: null, reason: "gathered before planning" })),
      steps: [],
      evidence: verifies.flatMap((v) => v.evidence.map((statement) => ({ statement, source: v.tool, kind: "OBSERVED", confidence: "HIGH" }))),
      outcome: verifies.at(-1)?.outcome ?? null,
      outcome_reason: verifies.at(-1)?.message ?? "",
      created_at: events[0].timestamp,
      completed_at: last.timestamp,
    };
  }

  const memories = [
    { id: "mem_sample_1", type: "SERVICE", key: "backend_port", value: { port: 8123 }, confidence_level: "HIGH", last_verified_at: iso(now - 14 * min), stale: false, conflict: null, reasons: ["mentioned in the request"], created_at: iso(now - 27 * hour), updated_at: iso(now - 14 * min), source: "you said so · task_sample_remember" },
    { id: "mem_sample_2", type: "COMMAND", key: "test_command", value: { command: "uv run pytest -q" }, confidence_level: "HIGH", last_verified_at: iso(now - 2.2 * hour), stale: false, conflict: null, reasons: ["intent: TASK"], created_at: iso(now - 9 * 24 * hour), updated_at: iso(now - 2.2 * hour), source: "observed · run_command" },
    { id: "mem_sample_3", type: "SERVICE", key: "frontend_port", value: { port: 3001 }, confidence_level: "LOW", last_verified_at: iso(now - 6 * 24 * hour), stale: true, conflict: "A live process is on :3000, not :3001.", reasons: [], created_at: iso(now - 12 * 24 * hour), updated_at: iso(now - 6 * 24 * hour), source: "you said so" },
    { id: "mem_sample_4", type: "PROJECT", key: "nexus_project", value: { path: WORKSPACE }, confidence_level: "HIGH", last_verified_at: iso(now - 40 * min), stale: false, conflict: null, reasons: ["active workspace"], created_at: iso(now - 20 * 24 * hour), updated_at: iso(now - 40 * min), source: "detected · detect_workspace" },
    { id: "mem_sample_5", type: "PREFERENCE", key: "python_runner", value: { tool: "uv" }, confidence_level: "MEDIUM", last_verified_at: null, stale: false, conflict: null, reasons: [], created_at: iso(now - 30 * 24 * hour), updated_at: iso(now - 30 * 24 * hour), source: "you said so" },
  ];

  const context = {
    intent: "ORIENT",
    active_workspace: {
      path: WORKSPACE, verified: true, project_types: ["python", "node"], is_git_repository: true,
      git_branch: "dikshanta", git_clean: false, changed_files: 4, active: true,
      recent_commits: ["e1d8b95 feat(evals): add event contract scoring for memory workflows", "0d9736e fix(evals): harden Langfuse integration and approval polling", "4ff005b refactor(evals): extract EvalHarness orchestration layer", "fcec363 refactor(evals): harden harness into versioned run envelopes"],
    },
    workspaces: [],
    memories: memories.slice(0, 3),
    processes: [
      { process_id: "proc_backend", name: "backend", status: "EXITED", port: 8123, working_directory: `${WORKSPACE}/backend` },
      { process_id: "proc_frontend", name: "frontend", status: "RUNNING", port: 3000, working_directory: `${WORKSPACE}/frontend` },
    ],
    machine: { platform: "macOS", architecture: "arm64", cpu_count: 10, battery_percentage: 78, charging: false },
    truncated: false,
  };
  context.workspaces = [context.active_workspace];

  const observations = [
    { observation_id: "obs_sample_1", category: "PROCESS", severity: "ERROR", title: "Backend stopped unexpectedly", summary: "backend exited with code 143 two minutes ago.", source: "detector", evidence: { exit_code: 143 }, workspace: WORKSPACE, related_process_id: "proc_backend", actionable: true, dismissed: false, created_at: iso(now - 2 * min) },
    { observation_id: "obs_sample_2", category: "GIT", severity: "WARNING", title: "Branch has 4 uncommitted files", summary: "dikshanta has changes that aren't committed.", source: "detector", evidence: { changed_files: 4 }, workspace: WORKSPACE, actionable: false, dismissed: false, created_at: iso(now - 6 * min) },
    { observation_id: "obs_sample_3", category: "MEMORY", severity: "INFO", title: "A memory disagrees with reality", summary: "frontend_port says 3001 but a process is on :3000.", source: "detector", evidence: { key: "frontend_port" }, workspace: WORKSPACE, related_memory_id: "mem_sample_3", actionable: true, dismissed: false, created_at: iso(now - 12 * min) },
  ];

  const suggestions = [
    { suggestion_id: "sug_sample_1", category: "PROCESS", severity: "ERROR", title: "Restart the backend?", description: "The backend exited with code 143. Want me to restart it?", reason: "A managed process you rely on stopped.", suggested_action: { intent: "investigate_process", prompt: "the backend exited, restart it", process_id: "proc_backend" }, observation_id: "obs_sample_1", status: "PENDING", created_at: iso(now - 2 * min), expires_at: iso(now + 20 * min) },
  ];

  const tools = TOOL_DEFS.map(([name, permission, description]) => ({
    name, permission, description, source: "nexus-mac", input_schema: {},
  }));

  return {
    context, memories, tools, observations, suggestions, tasks, taskEvents, traces, approvals,
    mcp: [{ name: "nexus-mac", status: "connected", tools: tools.length, reason: null }],
  };
}
