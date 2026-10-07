"use client";

import { useTheme } from "@/lib/theme";
import { WS_URL } from "@/lib/api";
import { useApp } from "../shell/NexusProvider";
import { Page } from "../shell/Page";
import { KeyRow } from "../ui/extras";
import { Badge, Kbd, StatusDot } from "../ui/primitives";

/** Settings: appearance, where data comes from, and the keys. */

function Choice({ name, value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="choice-grid">
      {options.map((o) => (
        <label key={o.value} className={`choice ${o.value === value ? "is-on" : ""}`}>
          <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
          <span className="t-h3">{o.label}</span>
          <span className="t-caption">{o.sub}</span>
        </label>
      ))}
    </div>
  );
}

const SHORTCUTS = [
  [["⌘", "K"], "Open the command palette"],
  [["A"], "Approve the request in view"],
  [["D"], "Deny the request in view"],
  [["E"], "Edit scope (deny and re-ask with limits)"],
  [["J"], "Next approval", ["K"], "previous"],
  [["/"], "Focus the message box"],
  [["Esc"], "Close a drawer or the palette"],
];

export function SettingsView() {
  const { pref, setPref } = useTheme();
  const { sourcePref, setSourcePref, source, liveRaw, liveOffline } = useApp();
  const api = WS_URL.replace(/^ws/, "http").replace(/\/api\/ws$/, "");

  return (
    <Page title="Settings" description="Preferences live in this browser. Nothing here changes what NEXUS is allowed to do on your Mac.">
      <section className="panel panel-pad mb-6">
        <h2 className="t-h2">Appearance</h2>
        <p className="t-caption mt-1 mb-4">Both themes use the same tokens; “System” follows your OS.</p>
        <Choice name="theme" label="Theme" value={pref} onChange={setPref} options={[
          { value: "system", label: "System", sub: "Match the OS setting" },
          { value: "light", label: "Light", sub: "White and indigo" },
          { value: "dark", label: "Dark", sub: "Deep navy and indigo" },
        ]} />
      </section>

      <section className="panel panel-pad mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="t-h2">Data source</h2>
          <Badge tone={source === "demo" ? "accent" : "ok"} dot>{source === "demo" ? "showing sample data" : "showing live data"}</Badge>
        </div>
        <p className="t-caption mt-1 mb-4">Auto shows live data and falls back to a simulated environment only while the backend is unreachable.</p>
        <Choice name="source" label="Data source" value={sourcePref} onChange={setSourcePref} options={[
          { value: "auto", label: "Auto", sub: "Live, with sample fallback" },
          { value: "live", label: "Live only", sub: "Never simulate" },
          { value: "demo", label: "Sample data", sub: "Simulated, touches nothing" },
        ]} />
        <dl className="mt-5">
          <KeyRow k="Backend"><span className="mono">{api}</span></KeyRow>
          <KeyRow k="Event stream"><span className="mono">{WS_URL}</span></KeyRow>
          <KeyRow k="Status"><span className="inline-flex items-center gap-2"><StatusDot tone={liveOffline ? "danger" : liveRaw?.online ? "ok" : "idle"} />{liveOffline ? "unreachable" : liveRaw?.online ? "connected" : "connecting"}</span></KeyRow>
        </dl>
      </section>

      <section className="panel panel-pad mb-6">
        <h2 className="t-h2">Keyboard</h2>
        <ul className="shortcuts">
          {SHORTCUTS.map(([keys, label, more, moreLabel]) => (
            <li key={label}>
              <span className="flex gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}{more ? <>{" "}<Kbd>{more[0]}</Kbd></> : null}</span>
              <span>{label}{moreLabel ? ` / ${moreLabel}` : ""}</span>
            </li>
          ))}
        </ul>
        <p className="t-caption mt-3">Single-key shortcuts never fire while you’re typing in a field.</p>
      </section>

      <section className="panel panel-pad">
        <h2 className="t-h2">What these settings can’t change</h2>
        <ul className="mt-3 space-y-2 text-[0.875rem] text-[var(--ink-2)]">
          <li>Approval is per call and never persists — there is no “always allow”.</li>
          <li>Permission tiers are decided by the backend’s policy, not by this interface.</li>
          <li>The backend binds to 127.0.0.1; the only external call is to the model provider.</li>
        </ul>
      </section>
    </Page>
  );
}
