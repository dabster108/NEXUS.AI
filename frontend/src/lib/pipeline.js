/**
 * The nine stages of one request, in the order the backend runs them.
 *
 * The single source for both the landing page's tour and the dashboard's
 * pipeline run card. Each `file` is the real module that does the work; if one
 * moves, this is the one place to change.
 *
 * `events` lists the backend ExecutionEvent types (backend/app/agent/events.py)
 * that mark a stage as started/finished — that mapping is what lets a run card
 * be derived from the same event stream the WebSocket already carries.
 */

export const STAGES = [
  {
    key: "intent",
    title: "Intent",
    body: "Deterministic regex classification decides what kind of request this is. No model call, so it's instant and repeatable.",
    file: "backend/app/context/intent.py",
    tag: "no model",
  },
  {
    key: "context",
    title: "Context",
    body: "Memories, workspace, Git state, processes and recent tasks, gathered fresh for this request and capped so it can't sprawl.",
    file: "backend/app/context/collector.py",
    tag: "bounded",
  },
  {
    key: "agent",
    title: "Agent",
    body: "LangGraph chooses from the tools the MCP server advertised. Agent ⇄ tools, with a hard step limit.",
    file: "backend/app/agent/graph.py",
    tag: "LangGraph",
  },
  {
    key: "policy",
    title: "Policy",
    body: "SAFE runs, CONFIRM stops, RESTRICTED never runs. Any tool nobody classified is RESTRICTED by default.",
    file: "backend/app/tools/permissions.py",
    tag: "gate",
  },
  {
    key: "approval",
    title: "Approval",
    body: "The tool node blocks until a person answers. Approval covers one call and never persists. A denial means the tool never starts.",
    file: "backend/app/agent/approvals.py",
    tag: "human",
  },
  {
    key: "mcp",
    title: "MCP",
    body: "JSON-RPC over stdio to a child process. It has no socket and must never be given one.",
    file: "backend/app/mcp/client.py",
    tag: "stdio",
  },
  {
    key: "mac",
    title: "macOS",
    body: "Thin adapters behind filesystem and command policies: no path traversal, no secret files, no pipes or shells.",
    file: "nexus-mac-mcp/src/nexus_mac_mcp/core/",
    tag: "confined",
  },
  {
    key: "verify",
    title: "Verify",
    body: "An independent re-check using SAFE tools only, against the contract the tool itself declared.",
    file: "backend/app/verification/verifier.py",
    tag: "SAFE-only",
  },
  {
    key: "outcome",
    title: "Outcome",
    body: "SUCCESS, PARTIAL_SUCCESS, FAILED or UNKNOWN, with each piece of evidence marked OBSERVED or INFERRED.",
    file: "backend/app/verification/outcomes.py",
    tag: "evidence",
  },
];
