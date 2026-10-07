"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./NexusProvider";
import { NAV_ITEMS } from "./nav";
import { setThemePref, useTheme } from "@/lib/theme";
import { Icon } from "../ui/icons";
import { Kbd } from "../ui/primitives";
import { describeRun } from "@/lib/runs";

/**
 * ⌘K. One input for three jobs: go somewhere, do something, or ask NEXUS.
 *
 * ARIA combobox/listbox on a native <dialog>, so focus is trapped and Esc
 * closes it without any code of ours. Typing anything adds an "Ask NEXUS"
 * entry — which sends a normal chat message, the same as the composer, so a
 * CONFIRM tool still stops at the approval prompt.
 */

function score(label, q) {
  const l = label.toLowerCase();
  if (!q) return 1;
  if (l.startsWith(q)) return 3;
  if (l.includes(q)) return 2;
  // loose subsequence
  let i = 0;
  for (const ch of l) if (ch === q[i]) i += 1;
  return i === q.length ? 1 : 0;
}

export function CommandPalette({ open, onClose }) {
  const { send, pending, decide, runs, toast, source, setSourcePref, reloadRuns } = useApp();
  const router = useRouter();
  const { resolved } = useTheme();
  const ref = useRef(null);
  const input = useRef(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      input.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    const go = (href) => () => router.push(href);
    const list = [];

    if (query.trim()) {
      list.push({
        id: "ask",
        group: "Ask NEXUS",
        label: query.trim(),
        icon: "spark",
        hint: "Send as a message",
        run: () => {
          router.push("/dashboard");
          send(query.trim());
        },
        pinned: true,
      });
    }

    for (const i of NAV_ITEMS) {
      list.push({ id: i.href, group: "Go to", label: i.label, icon: i.icon, hint: i.blurb, run: go(i.href) });
    }

    list.push(
      {
        id: "theme",
        group: "Actions",
        label: resolved === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolved === "dark" ? "sun" : "moon",
        run: () => setThemePref(resolved === "dark" ? "light" : "dark"),
      },
      {
        id: "reload",
        group: "Actions",
        label: "Reload run history",
        icon: "restart",
        run: () => {
          reloadRuns();
          toast({ tone: "neutral", title: "Reloading history", ttl: 2000 });
        },
      },
      {
        id: "source",
        group: "Actions",
        label: source === "demo" ? "Use live data" : "Use sample data",
        icon: "tools",
        run: () => setSourcePref(source === "demo" ? "live" : "demo"),
      },
    );

    if (pending[0]) {
      const p = pending[0];
      list.push(
        { id: "approve", group: "Actions", label: `Approve: ${p.description}`, icon: "check", hint: "this call only", run: () => decide(p.request_id, "approve") },
        { id: "deny", group: "Actions", label: `Deny: ${p.description}`, icon: "x", run: () => decide(p.request_id, "deny") },
      );
    }

    for (const r of runs.slice(0, 8)) {
      list.push({
        id: `run:${r.taskId}`,
        group: "Recent runs",
        label: r.request || r.taskId,
        icon: "timeline",
        hint: describeRun(r),
        run: go(`/dashboard/timeline?run=${encodeURIComponent(r.taskId)}`),
      });
    }

    // Navigation and actions rank first. "Ask NEXUS" leads only when nothing
    // else matches, so pressing Enter on "mem" opens Memory instead of
    // sending the word "mem" to the agent.
    const ORDER = ["Go to", "Actions", "Recent runs", "Ask NEXUS"];
    const scored = list
      .map((item) => ({ item, s: item.pinned ? 1 : score(`${item.label} ${item.hint ?? ""}`, q) }))
      .filter((x) => x.s > 0);
    const others = scored.filter((x) => !x.item.pinned && x.s >= 2);
    const askFirst = scored.some((x) => x.item.pinned) && others.length === 0;

    const groups = askFirst ? ["Ask NEXUS", ...ORDER.slice(0, 3)] : ORDER;
    return groups
      .flatMap((g) => scored.filter((x) => x.item.group === g).sort((a, b) => b.s - a.s))
      .map((x) => x.item)
      .slice(0, 14);
  }, [query, q, router, send, resolved, pending, runs, decide, toast, source, setSourcePref, reloadRuns]);

  const active = Math.min(index, Math.max(items.length - 1, 0));

  const choose = (item) => {
    if (!item) return;
    onClose();
    setQuery("");
    setIndex(0);
    item.run();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") (e.preventDefault(), setIndex((i) => (i + 1) % Math.max(items.length, 1)));
    else if (e.key === "ArrowUp") (e.preventDefault(), setIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1)));
    else if (e.key === "Enter") (e.preventDefault(), choose(items[active]));
  };

  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label="Command palette"
      onClose={() => {
        onClose();
        setQuery("");
        setIndex(0);
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="palette-panel">
        <div className="palette-input">
          <Icon name="search" size={16} />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `pal-${active}` : undefined}
            aria-label="Search or run a command"
            placeholder="Go to a view, run an action, or ask NEXUS…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <Kbd>esc</Kbd>
        </div>
        <ul id="palette-list" role="listbox" className="palette-list scroll">
          {items.length === 0 ? <li className="palette-empty">Nothing matches “{query}”.</li> : null}
          {items.map((item, i) => {
            const header = item.group !== items[i - 1]?.group;
            return (
              <li key={item.id} role="presentation">
                {header ? <p className="palette-group">{item.group}</p> : null}
                <div
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="palette-item"
                  onMouseMove={() => setIndex(i)}
                  onClick={() => choose(item)}
                >
                  <Icon name={item.icon} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint ? <span className="palette-hint">{item.hint}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="palette-foot">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> move</span>
          <span><Kbd>↵</Kbd> select</span>
          <span className="ml-auto">Nothing runs without your approval</span>
        </div>
      </div>
    </dialog>
  );
}
