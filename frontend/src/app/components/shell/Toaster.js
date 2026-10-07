"use client";

import Link from "next/link";
import { useApp } from "./NexusProvider";
import { Icon } from "../ui/icons";

const TONE_ICON = { ok: "check", warn: "warn", danger: "warn", neutral: "info", accent: "info" };

/** Transient notices. A polite live region: it never steals focus. */
export function Toaster() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toaster" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className={`toast-icon toast-${t.tone}`}>
            <Icon name={TONE_ICON[t.tone] ?? "info"} size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-h3 !text-[0.875rem]">{t.title}</p>
            {t.body ? <p className="t-caption mt-0.5 [overflow-wrap:anywhere]">{t.body}</p> : null}
            {t.action ? (
              <Link href={t.action.href} onClick={() => dismissToast(t.id)} className="link-arrow mt-1.5 text-[0.8125rem]">
                {t.action.label} <Icon name="arrow" size={12} className="arrow-nudge" />
              </Link>
            ) : null}
          </div>
          <button type="button" className="btn btn-quiet btn-icon !min-h-6 !min-w-6 !p-1" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
