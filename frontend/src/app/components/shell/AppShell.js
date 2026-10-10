"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { basename } from "@/lib/format";
import { useApp } from "./NexusProvider";
import { NAV, titleFor } from "./nav";
import { CommandPalette } from "./CommandPalette";
import { Toaster } from "./Toaster";
import { ThemeToggle } from "../ThemeToggle";
import { Icon } from "../ui/icons";
import { BrandMark } from "../ui/BrandMark";
import { StatusDot, Kbd } from "../ui/primitives";

/**
 * The command-center frame: a sidebar for where you are in the system, a thin
 * top bar for what is connected, and one scrolling pane for the view itself.
 *
 * Responsive: full sidebar ≥1024px, an icon rail on tablets, and a slide-over
 * sheet on phones. The interface gets louder only when the system does — the
 * Approvals badge and the top-bar progress line are the two things that move.
 */

function Brand({ compact = false }) {
  return (
    <Link href="/" className="brand" aria-label="NEXUS.ai — back to the home page">
      <BrandMark size={26} />
      {compact ? null : (
        <span className="brand-word">
          NEXUS<span className="text-[var(--accent-ink)]">.ai</span>
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ onNavigate }) {
  const pathname = usePathname();
  const { pending, attention } = useApp();
  const counts = { pending: pending.length };

  return (
    <nav aria-label="Dashboard" className="side-nav scroll">
      {NAV.map((group) => (
        <div key={group.group} className="side-group">
          <p className="side-heading">{group.group}</p>
          <ul>
            {group.items.map((item) => {
              const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
              const count = item.badge ? counts[item.badge] : 0;
              const hint = item.label === "Context" && attention ? attention : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className="nav-item"
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                  >
                    <Icon name={item.icon} />
                    <span className="nav-label">{item.label}</span>
                    {count ? (
                      <span className="nav-badge nav-badge-warn" aria-label={`${count} pending`}>
                        {count}
                      </span>
                    ) : hint ? (
                      <span className="nav-badge" aria-label={`${hint} need attention`}>
                        {hint}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Connection() {
  const { source, online, liveRaw } = useApp();
  const demo = source === "demo";
  const reconnecting = !demo && online === false;
  return (
    <div className="side-foot">
      <div className="conn">
        <StatusDot tone={demo ? "accent" : reconnecting ? "danger" : "ok"} live={!demo && !reconnecting} />
        <div className="min-w-0 nav-label">
          <p className="text-[0.8125rem] font-medium">{demo ? "Sample data" : reconnecting ? "Reconnecting…" : "Live"}</p>
          <p className="t-mono truncate">{demo ? "simulated · no backend" : liveRaw ? "127.0.0.1:8000" : ""}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * One line that says where the data on screen comes from. Constant height, so
 * "connecting" → "live" or "sample data" never shifts the page. Sample data is
 * the loudest state on purpose: nobody should mistake a simulation for a result.
 */
function StatusStrip({ pathname }) {
  const { source, sourcePref, setSourcePref, hydrated, liveRaw, mcp } = useApp();
  const connecting = source === "live" && !hydrated;
  const mac = mcp.find((s) => s.name === "nexus-mac") ?? mcp[0];

  // Evals are read from result files on disk, never from the backend or a mock.
  if (pathname.startsWith("/dashboard/evals")) {
    return (
      <div className="strip" role="status">
        <Icon name="evals" size={14} />
        <p><strong>Eval results</strong> <span className="hide-sm">are read straight from the files the harness wrote in</span> <span className="mono">evals/results/</span></p>
      </div>
    );
  }
  if (source === "demo") {
    return (
      <div className="strip strip-demo" role="status">
        <Icon name="info" size={14} />
        <p>
          <strong>Sample data.</strong>{" "}
          {sourcePref === "demo" ? "You chose the simulated environment." : "The backend at 127.0.0.1:8000 isn’t reachable, so this is a simulated environment."}{" "}
          <span className="hide-sm">Nothing here touches your Mac.</span>
        </p>
        {sourcePref !== "auto" ? (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setSourcePref("auto")}>Use live data</button>
        ) : (
          <span className="t-mono hide-sm">retrying live…</span>
        )}
      </div>
    );
  }
  return (
    <div className="strip" role="status">
      <StatusDot tone={connecting ? "idle" : liveRaw?.online === false ? "danger" : "ok"} live={!connecting && liveRaw?.online !== false} />
      <p>
        {connecting ? "Connecting to NEXUS…" : liveRaw?.online === false ? "Reconnecting…" : <><strong>Live</strong> <span className="mono">127.0.0.1:8000</span>{mac ? <span className="hide-sm"> · {mac.tools} tools over MCP</span> : null}</>}
      </p>
    </div>
  );
}

export function AppShell({ children }) {
  const pathname = usePathname();
  const { context, mcp, busy, hydrated } = useApp();
  const [sheet, setSheet] = useState(false);
  const [palette, setPalette] = useState(false);
  const sheetRef = useRef(null);

  const here = titleFor(pathname);
  const workspace = context?.active_workspace;
  const mac = mcp.find((s) => s.name === "nexus-mac") ?? mcp[0];

  // ⌘K / Ctrl+K opens the palette from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The mobile sheet is a native <dialog>: focus trap, Esc and inert backdrop for free.
  useEffect(() => {
    const d = sheetRef.current;
    if (!d) return;
    if (sheet && !d.open) d.showModal();
    if (!sheet && d.open) d.close();
  }, [sheet]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>

      <aside className="sidebar" aria-label="Sidebar">
        <div className="side-top">
          <Brand />
        </div>
        <SidebarNav />
        <Connection />
      </aside>

      <dialog
        ref={sheetRef}
        className="sheet-left"
        onClose={() => setSheet(false)}
        onClick={(e) => e.target === sheetRef.current && setSheet(false)}
        aria-label="Navigation"
      >
        <div className="sheet-panel">
          <div className="side-top">
            <Brand />
            <button type="button" className="btn btn-quiet btn-icon" onClick={() => setSheet(false)} aria-label="Close navigation">
              <Icon name="close" />
            </button>
          </div>
          <SidebarNav onNavigate={() => setSheet(false)} />
          <Connection />
        </div>
      </dialog>

      <div className="shell-col">
        <header className="topbar">
          <button type="button" className="btn btn-quiet btn-icon menu-btn" onClick={() => setSheet(true)} aria-label="Open navigation">
            <Icon name="menu" />
          </button>
          <div className="min-w-0">
            <p className="topbar-title">{here.label}</p>
          </div>
          {workspace ? (
            <span className="topbar-ws">
              <span aria-hidden className="text-[var(--ink-4)]">/</span>
              <span className="font-medium">{basename(workspace.path)}</span>
              {workspace.git_branch ? <span className="t-mono">{workspace.git_branch}</span> : null}
            </span>
          ) : null}

          <div className="topbar-right">
            {hydrated && mac ? (
              <span className={`chip hidden md:inline-flex ${mac.status === "connected" ? "" : "chip-warn"}`}>
                <StatusDot tone={mac.status === "connected" ? "ok" : "warn"} />
                Mac · {mac.tools} tools
              </span>
            ) : null}
            <button type="button" className="palette-trigger" onClick={() => setPalette(true)} aria-label="Open command palette">
              <Icon name="search" size={14} />
              <span className="hidden sm:inline">Search or run…</span>
              <Kbd>⌘K</Kbd>
            </button>
            <ThemeToggle />
          </div>
          <div className="topbar-progress" aria-hidden>
            {busy ? <i /> : null}
          </div>
        </header>

        {/* Always present, always the same height: the state changes, the layout never does. */}
        <StatusStrip pathname={pathname} />

        <main id="main" className="shell-main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <Toaster />
    </div>
  );
}
