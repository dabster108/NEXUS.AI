"use client";

import { useId } from "react";
import { Icon } from "./icons";
import { Sparkline } from "./primitives";

/** Segmented single-choice filter — a radiogroup, so arrow keys just work. */
export function Segmented({ options, value, onChange, label }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="segmented">
      {options.map((o) => (
        <label key={o.value} className={`seg ${o.value === value ? "is-on" : ""}`}>
          <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
          {o.count != null ? <span className="seg-count mono">{o.count}</span> : null}
        </label>
      ))}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Search…", label = "Search" }) {
  return (
    <label className="search-field">
      <Icon name="search" size={14} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} spellCheck={false} />
    </label>
  );
}

/** A number with a label. `trend` draws a sparkline beside it. */
export function Stat({ label, value, sub, tone, trend, children }) {
  return (
    <div className="stat">
      <p className="t-label">{label}</p>
      <div className="stat-row">
        <p className={`stat-value ${tone ? `tone-${tone}` : ""}`}>{value}</p>
        {trend ? <Sparkline values={trend} tone={tone ?? "accent"} width={88} height={28} /> : null}
      </div>
      {sub ? <p className="t-caption mt-1">{sub}</p> : null}
      {children}
    </div>
  );
}

export function KeyRow({ k, children }) {
  return (
    <div className="key-row">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}
