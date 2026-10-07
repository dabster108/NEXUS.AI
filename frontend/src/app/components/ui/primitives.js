import Link from "next/link";

/**
 * Presentational primitives with no client state, so server pages (evals,
 * landing) can use them without shipping JavaScript. Interactive ones — Tabs,
 * Drawer, Magnetic — live in ./interactive.js.
 *
 * Every primitive is a thin, named wrapper over the classes in ui.css, so the
 * look is defined once (tokens → ui.css) and the call sites stay readable.
 */

const cx = (...parts) => parts.filter(Boolean).join(" ");

export function Button({
  variant = "ghost",
  size = "md",
  href,
  icon = false,
  className,
  children,
  ...props
}) {
  const classes = cx(
    "btn",
    `btn-${variant}`,
    size !== "md" && `btn-${size}`,
    icon && "btn-icon",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

export function Card({ as: Tag = "div", hover = false, pad = true, className, children, ...props }) {
  return (
    <Tag className={cx("card", hover && "card-hover", pad && "p-4 sm:p-5", className)} {...props}>
      {children}
    </Tag>
  );
}

/** tone: neutral | accent | ok | warn | danger */
export function Badge({ tone = "neutral", mono = false, dot, className, children }) {
  return (
    <span
      className={cx(
        "chip",
        tone !== "neutral" && `chip-${tone}`,
        mono && "mono",
        className,
      )}
    >
      {dot ? <StatusDot tone={dot === true ? tone : dot} /> : null}
      {children}
    </span>
  );
}

/** tone: ok | warn | danger | accent | idle. `live` adds the animated halo. */
export function StatusDot({ tone = "idle", live = false, label, className }) {
  return (
    <span
      className={cx("dot", `dot-${tone}`, live && `dot-pulse-${tone}`, className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Skeleton({ className, style }) {
  return <div className={cx("shimmer", className)} style={style} aria-hidden />;
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty-state">
      {icon ? (
        <span className="empty-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <p className="t-h3">{title}</p>
      {children ? <p className="t-body mt-1 max-w-sm text-[0.875rem]">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", children, action }) {
  return (
    <div className="empty-state" role="alert">
      <span className="empty-icon empty-icon-danger" aria-hidden>
        !
      </span>
      <p className="t-h3">{title}</p>
      {children ? <p className="t-body mt-1 max-w-sm text-[0.875rem]">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** A semantic table. `columns`: [{ key, label, align?, render?(row) }]. */
export function Table({ columns, rows, rowKey, onRowClick, caption, dense = false, empty }) {
  return (
    <div className="table-wrap">
      <table className={cx("table", dense && "table-dense")}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === "right" ? "text-right" : undefined}>
                {c.label || <span className="sr-only">Actions</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? "is-clickable" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Terminal window. The one dark object in either theme: always --term-bg.
 * `title` shows in the chrome; `children` is the body (usually <pre>).
 */
export function Terminal({ title = "zsh", actions, className, children, ref, ...props }) {
  return (
    <div ref={ref} className={cx("terminal", className)} {...props}>
      <div className="terminal-bar">
        <span className="flex gap-1.5" aria-hidden>
          <i className="terminal-light" />
          <i className="terminal-light" />
          <i className="terminal-light" />
        </span>
        <span className="mono terminal-title">{title}</span>
        <span className="min-w-[56px] text-right">{actions}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * A horizontal/vertical stepper. `steps`: [{ key, label, state, meta? }] where
 * state is pending | running | done | block | skipped. Presentational: the
 * pipeline run card and the landing page both feed it.
 */
export function Stepper({ steps, orientation = "horizontal", label = "Progress" }) {
  return (
    <ol className={cx("stepper", `stepper-${orientation}`)} aria-label={label}>
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={cx("step", `step-${s.state}`)}
          aria-current={s.state === "running" ? "step" : undefined}
        >
          <span className="step-node" aria-hidden>
            {s.state === "done" ? "✓" : s.state === "block" ? "!" : String(i + 1)}
          </span>
          <span className="step-label">{s.label}</span>
          {s.meta ? <span className="step-meta mono">{s.meta}</span> : null}
          <span className="sr-only">{` — ${s.state}`}</span>
        </li>
      ))}
    </ol>
  );
}

/** Tiny inline trend. `values` are numbers 0..1 (or any range; it normalises). */
export function Sparkline({ values, width = 96, height = 28, tone = "accent", label }) {
  if (!values?.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts.at(-1);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`spark spark-${tone}`}
    >
      <path d={`${d} L${width} ${height} L0 ${height} Z`} className="spark-area" />
      <path d={d} className="spark-line" fill="none" />
      <circle cx={last[0]} cy={last[1]} r="2.5" className="spark-dot" />
    </svg>
  );
}

export { cx };
