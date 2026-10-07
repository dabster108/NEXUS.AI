import { NexusProvider } from "../components/shell/NexusProvider";
import { AppShell } from "../components/shell/AppShell";

export const metadata = {
  title: "Dashboard — NEXUS.ai",
  description: "The NEXUS command center: pipeline runs, approvals, memory, processes and evals.",
};

/**
 * The dashboard's persistent frame. Mounted once for every /dashboard/* route,
 * so the WebSocket, run history and any pending approval survive moving
 * between views.
 */
export default function DashboardLayout({ children }) {
  return (
    <NexusProvider>
      <AppShell>{children}</AppShell>
    </NexusProvider>
  );
}
