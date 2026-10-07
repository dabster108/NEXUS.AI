"use client";

import { useMemo, useState } from "react";
import { relativeTime, summariseValue } from "@/lib/format";
import { usePref } from "@/lib/prefs";
import { useApp } from "../shell/NexusProvider";
import { Page } from "../shell/Page";
import { Drawer } from "../ui/interactive";
import { Segmented, SearchField, KeyRow } from "../ui/extras";
import { Icon } from "../ui/icons";
import { Badge, EmptyState, Skeleton, StatusDot, Table } from "../ui/primitives";

/**
 * What NEXUS remembers. Browse, search, inspect where a fact came from, and
 * act on it — with the honest routing the backend demands:
 *
 *   Pin     — a local, per-browser convenience (the backend has no pinning).
 *   Verify  — a SAFE tool, so it just runs.
 *   Edit /
 *   Forget  — CONFIRM tools. There is deliberately no PUT/DELETE endpoint, so
 *             these send an ordinary message and meet the approval prompt.
 */

const CONF = { HIGH: "ok", MEDIUM: "warn", LOW: "danger" };

export function MemoryView() {
  const { memories, hydrated, online, source, ask } = useApp();
  const [pins, setPins] = usePref("nexus-pinned-memories", []);
  const [q, setQ] = useState("");
  const [view, setView] = useState("all");
  const [type, setType] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState("");

  const types = useMemo(() => ["all", ...new Set(memories.map((m) => m.type))], [memories]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return memories
      .filter((m) => {
        if (view === "stale" && !m.stale) return false;
        if (view === "current" && m.stale) return false;
        if (view === "pinned" && !pins.includes(m.key)) return false;
        if (type !== "all" && m.type !== type) return false;
        return !needle || `${m.key} ${summariseValue(m.value)} ${m.type}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => Number(pins.includes(b.key)) - Number(pins.includes(a.key)) || Number(b.stale) - Number(a.stale));
  }, [memories, q, view, type, pins]);

  const open = memories.find((m) => m.id === openId);
  const togglePin = (key) => setPins((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  const loading = source === "live" && !hydrated;

  return (
    <Page
      wide
      title="Memory"
      description="Typed, confidence-scored facts NEXUS carries between sessions. A fact is marked outdated the moment live evidence disagrees."
    >
      <div className="toolbar">
        <SearchField value={q} onChange={setQ} placeholder="Search memory…" label="Search memory" />
        <Segmented
          label="Filter"
          value={view}
          onChange={setView}
          options={[
            { value: "all", label: "All", count: memories.length },
            { value: "current", label: "Current" },
            { value: "stale", label: "Outdated", count: memories.filter((m) => m.stale).length },
            { value: "pinned", label: "Pinned", count: pins.length },
          ]}
        />
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          {types.map((t) => <option key={t} value={t}>{t === "all" ? "All types" : t.toLowerCase()}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="panel skeleton-rows" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : (
        <Table
          caption="Remembered facts"
          rowKey={(m) => m.id}
          rows={rows}
          onRowClick={(m) => { setOpenId(m.id); setDraft(summariseValue(m.value)); }}
          empty={
            <EmptyState icon={<Icon name="memory" size={20} />} title={online === false && source === "live" ? "Backend unreachable" : memories.length ? "No memories match" : "Nothing remembered yet"}>
              {memories.length ? "Try a different filter." : "Tell NEXUS something — “remember that the backend port is 8123” — and it will ask before saving it."}
            </EmptyState>
          }
          columns={[
            { key: "key", label: "Fact", render: (m) => (
              <span className="flex items-center gap-2">
                {pins.includes(m.key) ? <Icon name="pin" size={13} className="text-[var(--accent)]" /> : null}
                <span><span className="cell-title mono !text-[0.8125rem]">{m.key}</span><span className="cell-sub">{m.type.toLowerCase()}</span></span>
              </span>
            ) },
            { key: "value", label: "Value", render: (m) => <span className="mono text-[0.75rem] [overflow-wrap:anywhere]">{summariseValue(m.value)}</span> },
            { key: "conf", label: "Confidence", render: (m) => m.stale
              ? <Badge tone="warn" dot>outdated</Badge>
              : <Badge tone={CONF[m.confidence_level] ?? "neutral"} dot>{(m.confidence_level ?? "").toLowerCase()}</Badge> },
            { key: "ver", label: "Verified", render: (m) => <span className="t-caption">{relativeTime(m.last_verified_at)}</span> },
            { key: "act", label: "", align: "right", render: (m) => (
              <span className="row-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <button type="button" className="btn btn-quiet btn-icon" aria-label={pins.includes(m.key) ? `Unpin ${m.key}` : `Pin ${m.key}`} aria-pressed={pins.includes(m.key)} title="Pin (this browser)" onClick={() => togglePin(m.key)}><Icon name="pin" size={14} /></button>
                <button type="button" className="btn btn-quiet btn-icon" aria-label={`Forget ${m.key}`} title="Forget — asks for approval" onClick={() => ask(`Forget the memory "${m.key}".`, { title: `Asking to forget ${m.key}`, gated: true })}><Icon name="trash" size={14} /></button>
              </span>
            ) },
          ]}
        />
      )}

      <Drawer open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.key ?? "Memory"} subtitle={open?.id} width={480}>
        {open ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={open.stale ? "warn" : CONF[open.confidence_level] ?? "neutral"} dot>{open.stale ? "outdated" : `${(open.confidence_level ?? "").toLowerCase()} confidence`}</Badge>
              <Badge>{open.type.toLowerCase()}</Badge>
              {pins.includes(open.key) ? <Badge tone="accent">pinned · this browser</Badge> : null}
            </div>

            {open.conflict ? (
              <p className="callout callout-warn"><StatusDot tone="warn" /> {open.conflict}</p>
            ) : null}

            <dl>
              <KeyRow k="Value"><span className="mono text-[0.8125rem]">{summariseValue(open.value)}</span></KeyRow>
              <KeyRow k="Source">{open.source ?? <span className="t-caption">not recorded by the backend</span>}</KeyRow>
              <KeyRow k="Last verified">{open.last_verified_at ? `${relativeTime(open.last_verified_at)} · ${new Date(open.last_verified_at).toLocaleString()}` : "never"}</KeyRow>
              <KeyRow k="Created">{open.created_at ? new Date(open.created_at).toLocaleString() : "—"}</KeyRow>
              <KeyRow k="Updated">{open.updated_at ? new Date(open.updated_at).toLocaleString() : "—"}</KeyRow>
              <KeyRow k="Why relevant">{open.reasons?.length ? open.reasons.join(" · ") : <span className="t-caption">not used by a recent request</span>}</KeyRow>
            </dl>

            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                ask(`Update memory ${open.key} to ${draft.trim()}`, { title: `Asking to update ${open.key}`, gated: true });
                setOpenId(null);
              }}
            >
              <label htmlFor="mem-edit" className="t-label">Edit value</label>
              <div className="flex gap-2">
                <input id="mem-edit" className="field mono" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>Save</button>
              </div>
              <p className="t-caption">Saving is a CONFIRM action: it goes through chat and stops for your approval, with a before/after diff.</p>
            </form>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => { ask(`Verify the memory "${open.key}" against the live environment.`, { title: `Verifying ${open.key}` }); setOpenId(null); }}>
                <Icon name="check" size={14} /> Verify now <span className="t-caption">(read-only)</span>
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => togglePin(open.key)}>
                <Icon name="pin" size={14} /> {pins.includes(open.key) ? "Unpin" : "Pin"}
              </button>
              <button type="button" className="btn btn-ghost btn-danger" onClick={() => { ask(`Forget the memory "${open.key}".`, { title: `Asking to forget ${open.key}`, gated: true }); setOpenId(null); }}>
                <Icon name="trash" size={14} /> Forget
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </Page>
  );
}
