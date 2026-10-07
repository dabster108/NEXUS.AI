"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "./motion";

/**
 * The product preview: one request, replayed.
 *
 * Built out of the same primitives as the real dashboard rather than a
 * screenshot, and it plays the loop the product actually runs — ask, gather
 * context, answer, stop for approval, act, verify, report the evidence — in
 * that order, because that order is the argument. The content is illustrative
 * and labelled as such in the caption below it.
 *
 * It only plays while on screen. Under reduced motion it shows the finished
 * run, still, which carries the same information.
 */

const USER_TEXT = "the api died again, restart it";
const REPLY_TEXT =
  "The backend on port 8123 exited two minutes ago with code 143. Restarting it changes your Mac, so it needs your approval.";

/** Duration of each step in ms. Index = step. */
const STEPS = [
  { ms: 500, phase: 0 }, // idle
  { ms: 1500, phase: 0 }, // user types
  { ms: 1500, phase: 1 }, // context gathered
  { ms: 1900, phase: 2 }, // reply streams
  { ms: 900, phase: 3 }, // approval appears
  { ms: 1200, phase: 3 }, // cursor approves
  { ms: 1500, phase: 4 }, // tool runs
  { ms: 1300, phase: 5 }, // verification
  { ms: 4200, phase: 5 }, // outcome held
];
const FINAL = STEPS.length - 1;

const PHASES = ["Ask", "Context", "Answer", "Approve", "Act", "Verify"];

const CONTEXT = [
  ["workspace", "distributed-systems-lab"],
  ["git", "dikshanta · 4 changes"],
  ["process", "backend · exited 143"],
  ["memory", "backend port = 8123"],
];

function Spark({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2.2l1.5 3.9 3.9 1.5-3.9 1.5L8 13l-1.5-3.9L2.6 7.6l3.9-1.5L8 2.2z"
        fill="var(--accent)"
      />
    </svg>
  );
}

function Cursor() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden>
      <path
        d="M1.5 1.5l11.8 7.2-5.1 1.1-2.4 4.9L1.5 1.5z"
        fill="var(--term-bg)"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function usePointerTilt(ref, enabled) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let frame = 0;
    const onMove = (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setTilt({ x: y * -3, y: x * 4 });
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      setTilt({ x: 0, y: 0 });
    };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, [ref, enabled]);
  return tilt;
}

export function ProductPreview() {
  const wrapRef = useRef(null);
  const reduced = useReducedMotion();
  const visible = useInView(wrapRef, { threshold: 0.25 });
  const tilt = usePointerTilt(wrapRef, !reduced);

  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const playing = visible && !reduced;
  const shown = reduced ? FINAL : step;

  // Advance through the script; loop back after the outcome has been read.
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setElapsed(0);
      setStep((s) => (s >= FINAL ? 0 : s + 1));
    }, STEPS[step].ms);
    return () => clearTimeout(id);
  }, [playing, step]);

  // A clock only while text is being typed or streamed.
  useEffect(() => {
    if (!playing || (step !== 1 && step !== 3)) return;
    const started = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setElapsed(now - started);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, step]);

  const typed =
    shown > 1 ? USER_TEXT : shown === 1 ? USER_TEXT.slice(0, Math.floor(elapsed / 38)) : "";
  const replyWords = REPLY_TEXT.split(" ");
  const streamed =
    shown > 3
      ? REPLY_TEXT
      : shown === 3
        ? replyWords.slice(0, Math.floor(elapsed / 70)).join(" ")
        : "";
  const phase = STEPS[shown].phase;
  const approved = shown >= 6 || (shown === 5 && !playing);

  return (
    <div ref={wrapRef} className="parallax-y relative" style={{ perspective: "1800px" }}>
      <div aria-hidden className="preview-glow parallax-slow" />
      <div
        className="window-frame relative overflow-hidden rounded-[var(--r-2xl)] border bg-[var(--surface)]"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 600ms var(--ease)",
        }}
        role="img"
        aria-label="Animated illustration: NEXUS gathers context, asks for approval to restart a crashed backend, runs it, and verifies the result."
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/70" />
          </span>
          <span className="mono mx-auto flex items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
            <span className="dot dot-live !h-[5px] !w-[5px]" />
            nexus · 127.0.0.1
          </span>
        </div>

        <div className="grid sm:grid-cols-[1fr_176px]">
          {/* the conversation */}
          <div className="min-h-[348px] min-w-0 bg-[var(--surface)] p-4 sm:p-5">
            <div className="flex min-h-[26px] justify-end">
              {typed ? (
                <p className="max-w-[80%] rounded-[10px] rounded-br-[3px] border border-[var(--term-line)] bg-[var(--term-bg)] px-2.5 py-1.5 text-[11.5px] leading-[1.5] text-[var(--term-ink)]">
                  {typed}
                  {shown === 1 ? <span className="type-caret" /> : null}
                </p>
              ) : null}
            </div>

            {shown >= 2 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {CONTEXT.map(([kind, value], i) => (
                  <span
                    key={kind}
                    className="enter-pop chip !gap-1 !px-2 !text-[11px]"
                    style={{ "--i": i }}
                  >
                    <span className="mono text-[var(--ink-3)]">{kind}</span>
                    <span className="text-[var(--ink)]">{value}</span>
                  </span>
                ))}
              </div>
            ) : null}

            {shown >= 2 ? (
              <div className="mt-3 flex gap-2">
                <span className="mt-[1px] grid h-[20px] w-[20px] flex-none place-items-center rounded-[6px] border border-[var(--accent-line)] bg-[var(--accent-bg)]">
                  <Spark />
                </span>
                {streamed ? (
                  <p className="text-[11.5px] leading-[1.6] text-[var(--ink)]">{streamed}</p>
                ) : (
                  <span className="flex items-center gap-1 pt-1.5" aria-hidden>
                    <span className="thinking-dot dot dot-accent" />
                    <span className="thinking-dot dot dot-accent" />
                    <span className="thinking-dot dot dot-accent" />
                    <span className="ml-1.5 text-[11px] text-[var(--ink-3)]">
                      Checking your environment
                    </span>
                  </span>
                )}
              </div>
            ) : null}

            {/* the approval: the one moment NEXUS asks for responsibility */}
            {shown >= 4 ? (
              <div
                className={`enter-pop relative mt-3 rounded-[10px] border bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow-sm)] transition-colors duration-300 ${
                  approved ? "border-[var(--ok)]/40" : "border-[var(--warn)]/50"
                }`}
              >
                <p
                  className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] ${
                    approved ? "text-[var(--ok-ink)]" : "text-[var(--warn-ink)]"
                  }`}
                >
                  <span className={`dot !h-1.5 !w-1.5 ${approved ? "dot-ok" : "dot-warn"}`} />
                  {approved ? "Approved · this call only" : "Approval needed · CONFIRM"}
                </p>
                <p className="mt-1 text-[11.5px] font-semibold leading-4">
                  Start the development server in distributed-systems-lab
                </p>
                <div className="relative mt-2 flex items-center gap-1.5">
                  <span
                    className={`rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-[transform,background-color] duration-150 ${
                      shown === 5 ? "approve-press" : shown === 4 ? "btn-pulse" : ""
                    } ${
                      approved
                        ? "border border-[var(--ok)]/50 bg-[var(--ok-bg)] text-[var(--ok-ink)]"
                        : "bg-[var(--accent)] text-[var(--on-accent)]"
                    }`}
                  >
                    {approved ? "Approved" : "Approve"}
                  </span>
                  <span className="rounded-[6px] border border-[var(--line-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)]">
                    Don&rsquo;t run it
                  </span>
                  <span className="mono ml-auto text-[10px] text-[var(--ink-3)]">
                    start_process
                  </span>
                  {shown === 5 && playing ? (
                    <span className="demo-cursor pointer-events-none absolute left-0 top-0">
                      <Cursor />
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* act → verify → outcome */}
            {shown >= 6 ? (
              <div className="enter-pop mt-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-[11px] font-semibold">
                    {shown === 6
                      ? "Starting backend…"
                      : shown === 7
                        ? "Verifying with SAFE checks…"
                        : "Restarted and verified"}
                  </p>
                  <span className="mono text-[10px] text-[var(--ink-3)]">
                    {shown >= 8 ? "3/3" : shown === 7 ? "2/3" : "1/3"}
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-[var(--ease)]"
                    style={{ width: shown >= 8 ? "100%" : shown === 7 ? "66%" : "33%" }}
                  />
                </div>
                {shown >= 8 ? (
                  <div className="enter-sm mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="chip chip-ok !px-2 !text-[11px]">
                      <span aria-hidden>✓</span> SUCCESS
                    </span>
                    <span className="chip !px-2 !text-[11px]">
                      <span className="mono text-[var(--ink-3)]">OBSERVED</span>
                      process_status → running
                    </span>
                    <span className="chip !px-2 !text-[11px]">
                      <span className="mono text-[var(--ink-3)]">OBSERVED</span>
                      :8123 answered HTTP 200
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* the rail: quiet, slate, and only what it actually knows */}
          <div className="hidden divide-y divide-[var(--line)] border-l border-[var(--line)] bg-[var(--bg)] sm:block">
            <div className="p-3">
              <p className="t-label !text-[10px]">Understands</p>
              <p className="mt-1.5 text-[11px] font-semibold leading-4">
                distributed-systems-lab
              </p>
              <p className="mono mt-0.5 text-[10px] text-[var(--ink-3)]">dikshanta · 4 changes</p>
            </div>

            <div className="p-3">
              <p className="t-label !text-[10px]">Noticed</p>
              <div className="mt-1.5 space-y-1.5">
                {shown >= 8 ? (
                  <div className="enter-sm flex items-start gap-1.5">
                    <span className="dot dot-ok mt-[4px]" />
                    <div className="min-w-0">
                      <p className="text-[10px] leading-[13px] text-[var(--ink-2)]">
                        Backend recovered
                      </p>
                      <p className="mono text-[10px] text-[var(--ink-3)]">127.0.0.1:8123 · now</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-start gap-1.5">
                  <span
                    className={`dot mt-[4px] ${shown >= 8 ? "dot-idle" : "dot-danger"}`}
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] leading-[13px] text-[var(--ink-2)]">
                      Backend stopped unexpectedly
                    </p>
                    <p className="mono text-[10px] text-[var(--ink-3)]">exit 143 · 2m</p>
                  </div>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="dot dot-warn mt-[4px]" />
                  <div className="min-w-0">
                    <p className="text-[10px] leading-[13px] text-[var(--ink-2)]">
                      Branch has 4 uncommitted files
                    </p>
                    <p className="mono text-[10px] text-[var(--ink-3)]">git · 6m</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3">
              <p className="t-label !text-[10px]">Remembers</p>
              <p className="mt-1.5 text-[10px] font-medium leading-[13px]">backend port</p>
              <p className="mono text-[10px] text-[var(--ink-2)]">8123 · high confidence</p>
            </div>
          </div>
        </div>
      </div>

      {/* where in the loop we are */}
      <ol className="mt-5 flex flex-wrap items-center justify-center gap-x-1 gap-y-2" aria-hidden>
        {PHASES.map((label, i) => (
          <li key={label} className="flex items-center gap-1">
            <span
              className={`phase-pill ${i === phase ? "is-active" : i < phase ? "is-done" : ""}`}
            >
              {label}
            </span>
            {i < PHASES.length - 1 ? (
              <span className="h-px w-3 bg-[var(--line-2)] sm:w-5" />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
