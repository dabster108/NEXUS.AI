/**
 * A view's frame: title row + scrollable body. The Command view doesn't use
 * it (it manages its own panes); every other view does, so spacing, widths and
 * headings stay identical across the app.
 */
export function Page({ title, description, actions, children, wide = false }) {
  return (
    <div className="page scroll" tabIndex={0} role="region" aria-label={title}>
      <div className={`page-inner ${wide ? "page-wide" : ""}`}>
        <header className="page-head">
          <div className="min-w-0">
            <h1 className="t-h1 page-title">{title}</h1>
            {description ? <p className="t-body mt-1.5 max-w-2xl">{description}</p> : null}
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

/** Marks anything that is not backed by a real endpoint, even in live mode. */
export function MockBadge({ children = "Sample" }) {
  return (
    <span className="mock-badge" title="Not backed by a backend endpoint yet — shown from the mock adapter">
      {children}
    </span>
  );
}
