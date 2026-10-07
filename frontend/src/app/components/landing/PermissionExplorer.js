"use client";

import { useState } from "react";

/**
 * The three permission levels, with the real tools in each.
 *
 * The lists mirror the metadata `nexus-mac-mcp/server.py` declares; the
 * backend reads that metadata at discovery and its policy — not this page, and
 * not the child process — decides what runs.
 */

const LEVELS = [
  {
    id: "safe",
    name: "SAFE",
    tone: "ok",
    verdict: "Runs immediately",
    body: "Read-only. The agent can look without asking, because looking changes nothing.",
    tools: [
      "battery_status", "system_info", "running_processes", "detect_workspace",
      "repo_overview", "git_status", "git_branch", "git_log", "git_diff",
      "list_directory", "search_files", "read_file", "list_processes",
      "process_status", "process_logs", "check_local_service", "list_memories",
      "get_memory", "verify_memory",
    ],
  },
  {
    id: "confirm",
    name: "CONFIRM",
    tone: "warn",
    verdict: "Stops for you, every time",
    body: "Changes something. The tool node blocks with the arguments shown until you approve or deny that one call.",
    tools: [
      "open_application", "run_command", "start_process", "stop_process",
      "save_memory", "delete_memory",
    ],
  },
  {
    id: "restricted",
    name: "RESTRICTED",
    tone: "danger",
    verdict: "Never executes",
    body: "The default for any tool nobody classified. A new or unknown tool can't run just by existing.",
    tools: [],
    absent: [
      "unclassified tools", "shell pipes & chaining", "AppleScript",
      "GUI / keyboard control", "browser automation", "email & calendar",
    ],
  },
];

export function PermissionExplorer() {
  const [current, setCurrent] = useState("safe");
  const level = LEVELS.find((l) => l.id === current);

  return (
    <div className="perm-explorer card section-card overflow-hidden">
      <div role="tablist" aria-label="Permission levels" className="grid grid-cols-3 border-b border-[var(--line)]">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            id={`perm-tab-${l.id}`}
            aria-selected={l.id === current}
            aria-controls="perm-panel"
            onClick={() => setCurrent(l.id)}
            className={`perm-tab perm-${l.tone}`}
          >
            <span className="mono text-[11px] font-semibold tracking-[0.06em] sm:text-[12px]">
              {l.name}
            </span>
            <span className="text-[1.375rem] font-semibold tabular-nums tracking-[-0.03em] text-[var(--ink)] sm:text-[1.75rem]">
              {l.tools.length}
            </span>
            <span className="hidden text-[11.5px] text-[var(--ink-3)] sm:block">{l.verdict}</span>
          </button>
        ))}
      </div>

      <div
        id="perm-panel"
        role="tabpanel"
        aria-labelledby={`perm-tab-${current}`}
        className="min-h-[248px] p-5 sm:p-6"
      >
        <div key={current}>
          <p className="enter t-body max-w-xl !text-[0.875rem]">{level.body}</p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {level.tools.map((tool, i) => (
              <span
                key={tool}
                className={`enter-pop chip mono !text-[11.5px] perm-chip-${level.tone}`}
                style={{ "--i": i }}
              >
                <span className={`dot dot-${level.tone}`} />
                {tool}
              </span>
            ))}
            {(level.absent ?? []).map((thing, i) => (
              <span
                key={thing}
                className="enter-pop chip !text-[11.5px] line-through decoration-[var(--danger)]/50"
                style={{ "--i": i }}
              >
                {thing}
              </span>
            ))}
          </div>
          {level.id === "restricted" ? (
            <p className="enter t-meta mt-4" style={{ "--i": 4 }}>
              None of the 25 bundled tools is RESTRICTED; the struck-through items above
              are deliberately absent, with no tool at all.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
