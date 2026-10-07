"use client";

import { useRef } from "react";
import { formatDuration } from "@/lib/runs";

/**
 * The nine stages of a run as a track: a rail that fills, a packet that rides
 * it while the run is live, and a node per stage that glows when active.
 *
 * It is a WAI-ARIA tablist (roving tabindex, arrow/Home/End) whose panel is
 * rendered by the caller via `aria-controls`, so the same track serves the
 * live run card and the timeline drawer. Responsive by container query: nine
 * across when there's room, three rows of three when there isn't.
 */

const GLYPH = { done: "✓", failed: "✕", block: "!", skipped: "–" };

export function PipelineTrack({ run, selected, onSelect, panelId, idPrefix = "trk" }) {
  const refs = useRef([]);
  const stages = run.stages;

  const lastDone = stages.reduce((n, s, i) => (["done", "failed"].includes(s.state) ? i : n), -1);
  const activeIdx = stages.findIndex((s) => s.state === "running" || s.state === "block");
  const head = activeIdx >= 0 ? activeIdx : Math.max(lastDone, 0);
  const progress = head / (stages.length - 1);
  const live = activeIdx >= 0;

  const focus = (i) => {
    const n = (i + stages.length) % stages.length;
    onSelect(stages[n].key);
    refs.current[n]?.focus();
  };

  return (
    <div className="track" data-live={live || undefined}>
      <div className="track-rail" aria-hidden>
        <i className="track-fill" style={{ transform: `scaleX(${progress})` }} />
        {live ? <i className="track-packet" style={{ left: `${progress * 100}%` }} /> : null}
      </div>
      <div className="track-nodes" role="tablist" aria-label="Pipeline stages">
        {stages.map((s, i) => {
          const isSel = selected === s.key;
          return (
            <button
              key={s.key}
              ref={(n) => {
                refs.current[i] = n;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-${s.key}`}
              aria-selected={isSel}
              aria-controls={panelId}
              tabIndex={isSel || (selected == null && i === Math.max(activeIdx, 0)) ? 0 : -1}
              onClick={() => onSelect(isSel ? null : s.key)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") (e.preventDefault(), focus(i + 1));
                else if (e.key === "ArrowLeft") (e.preventDefault(), focus(i - 1));
                else if (e.key === "Home") (e.preventDefault(), focus(0));
                else if (e.key === "End") (e.preventDefault(), focus(stages.length - 1));
              }}
              className={`track-node is-${s.state} ${isSel ? "is-selected" : ""}`}
            >
              <span className="track-dot">
                <span className="track-glyph mono">{GLYPH[s.state] ?? String(i + 1).padStart(2, "0")}</span>
              </span>
              <span className="track-label">{s.title}</span>
              <span className="track-meta mono">
                {s.state === "running" ? "…" : s.state === "block" ? "waiting" : s.state === "skipped" ? "n/a" : s.durationMs != null ? formatDuration(s.durationMs) : s.state === "pending" ? "" : "·"}
              </span>
              <span className="sr-only">{`, ${s.state}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The detail for one stage: what it did, in the backend's own words. */
export function StageDetail({ stage, id, labelledBy }) {
  if (!stage) return null;
  return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} className="stage-detail enter-sm" tabIndex={0}>
      <div className="stage-detail-head">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="t-h3">{stage.title}</h4>
          <span className={`chip state-chip state-${stage.state}`}>{stage.state === "block" ? "waiting" : stage.state}</span>
          {stage.durationMs != null ? <span className="t-mono">{formatDuration(stage.durationMs)}</span> : null}
        </div>
        <code className="t-mono stage-file" title="The module that runs this stage">{stage.file}</code>
      </div>
      {stage.summary ? <p className="t-body mt-1.5 !text-[0.875rem]">{stage.summary}</p> : null}
      {stage.details.length ? (
        <dl className="stage-dl">
          {stage.details.map((d, i) => (
            <div key={`${d.label}-${i}`} className="stage-row">
              <dt>{d.label}</dt>
              <dd className={`${d.mono ? "mono" : ""} ${d.muted ? "is-muted" : ""} ${d.tone ? `tone-${d.tone}` : ""}`}>{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="t-caption mt-2">Nothing recorded for this stage yet.</p>
      )}
    </div>
  );
}
