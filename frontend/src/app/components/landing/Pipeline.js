"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "./motion";
import { Terminal } from "../ui/primitives";

/**
 * The request path, as a track a packet travels along.
 *
 * Every stop is a real stage with a real file behind it, in the order the
 * backend runs them (the same nine stages the dashboard's run card shows — see
 * lib/pipeline.js). It advances on its own while on screen; choosing a stop,
 * or hovering/focusing the track, takes over, because a reader who reached for
 * it wants to read.
 *
 * ARIA: the track is a tablist (roving tabindex, arrow/Home/End keys) and the
 * detail card is its tabpanel.
 */

import { STAGES } from "@/lib/pipeline";

const TOUR_MS = 2400;

export function Pipeline() {
  const ref = useRef(null);
  const tabs = useRef([]);
  const reduced = useReducedMotion();
  const visible = useInView(ref, { threshold: 0.35 });
  const [active, setActive] = useState(0);
  const [touring, setTouring] = useState(true);
  const [hovering, setHovering] = useState(false);

  const running = touring && visible && !reduced && !hovering;

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setActive((i) => (i + 1) % STAGES.length), TOUR_MS);
    return () => clearTimeout(id);
  }, [running, active]);

  const choose = (i, focus = false) => {
    setTouring(false);
    setActive(i);
    if (focus) tabs.current[i]?.focus();
  };

  const stage = STAGES[active];
  const progress = active / (STAGES.length - 1);

  return (
    <div
      ref={ref}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <div className="relative">
        <div aria-hidden className="pipeline-rail">
          <div className="pipeline-rail-fill" style={{ transform: `scaleX(${progress})` }} />
          <div className="pipeline-packet" style={{ left: `${progress * 100}%` }} />
        </div>
        <div
          className="relative grid grid-cols-3 gap-y-5 sm:grid-cols-9"
          role="tablist"
          aria-label="Request path stages"
        >
          {STAGES.map((s, i) => (
            <div key={s.key} className="flex justify-center" role="presentation">
              <button
                ref={(node) => {
                  tabs.current[i] = node;
                }}
                type="button"
                role="tab"
                id={`stage-tab-${s.key}`}
                aria-selected={i === active}
                aria-controls="pipeline-detail"
                tabIndex={i === active ? 0 : -1}
                onClick={() => choose(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") (e.preventDefault(), choose((i + 1) % STAGES.length, true));
                  if (e.key === "ArrowLeft") (e.preventDefault(), choose((i - 1 + STAGES.length) % STAGES.length, true));
                  if (e.key === "Home") (e.preventDefault(), choose(0, true));
                  if (e.key === "End") (e.preventDefault(), choose(STAGES.length - 1, true));
                }}
                className={`pipeline-node ${i === active ? "is-active" : i < active ? "is-done" : ""}`}
              >
                <span className="pipeline-dot">
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <span className="pipeline-label">{s.title}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        id="pipeline-detail"
        role="tabpanel"
        aria-labelledby={`stage-tab-${stage.key}`}
        className="pipeline-detail"
        aria-live="polite"
      >
        <Terminal
          title={stage.file}
          className="stage-card relative"
          actions={
            !touring ? (
              <button
                type="button"
                className="dk-btn !py-0.5 !text-[11px]"
                onClick={() => setTouring(true)}
                aria-label="Resume the automatic tour"
              >
                ▶ Tour
              </button>
            ) : null
          }
        >
          <div key={stage.key} className="enter stage-body grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="mono text-[12px] text-[var(--term-ink-3)]">
                  {String(active + 1).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
                </span>
                <span className="dk-chip">{stage.tag}</span>
              </div>
              <h3 className="mt-3 text-[1.75rem] font-semibold tracking-[-0.03em] text-[var(--term-ink)]">
                {stage.title}
              </h3>
              <p className="mt-2 max-w-xl text-[0.9375rem] leading-[1.7] text-[var(--term-ink-2)]">
                {stage.body}
              </p>
            </div>
            <code className="mono stage-path rounded-[8px] border border-[var(--term-line)] bg-white/[0.04] px-3 py-2 text-[12px] [overflow-wrap:anywhere] sm:max-w-[280px]">
              {stage.file}
            </code>
          </div>
          {running ? (
            <span className="tour-progress" aria-hidden>
              <i key={active} />
            </span>
          ) : null}
        </Terminal>
      </div>
    </div>
  );
}
