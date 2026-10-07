/** The information architecture, in one place: sidebar, palette and titles read it. */

export const NAV = [
  {
    group: "Operate",
    items: [
      { href: "/dashboard", label: "Command", icon: "command", blurb: "Ask, and watch the pipeline run" },
      { href: "/dashboard/approvals", label: "Approvals", icon: "approvals", badge: "pending", blurb: "Decisions waiting on you" },
      { href: "/dashboard/timeline", label: "Timeline", icon: "timeline", blurb: "Every run, with its evidence" },
    ],
  },
  {
    group: "Understand",
    items: [
      { href: "/dashboard/context", label: "Context", icon: "context", blurb: "What NEXUS sees right now" },
      { href: "/dashboard/memory", label: "Memory", icon: "memory", blurb: "What NEXUS remembers" },
      { href: "/dashboard/processes", label: "Processes", icon: "processes", blurb: "Managed processes and health" },
      { href: "/dashboard/git", label: "Git & Workspace", icon: "git", blurb: "Branch, changes, commits" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/dashboard/tools", label: "Tools (MCP)", icon: "tools", blurb: "Capabilities and permission tiers" },
      { href: "/dashboard/evals", label: "Evals", icon: "evals", blurb: "Measured quality, run by run" },
      { href: "/dashboard/audit", label: "Audit log", icon: "audit", blurb: "Every decision, append-only" },
      { href: "/dashboard/settings", label: "Settings", icon: "settings", blurb: "Theme, data source, shortcuts" },
    ],
  },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);

export function titleFor(pathname) {
  const exact = NAV_ITEMS.find((i) => i.href === pathname);
  if (exact) return exact;
  return NAV_ITEMS.filter((i) => i.href !== "/dashboard").find((i) => pathname.startsWith(i.href)) ?? NAV_ITEMS[0];
}
