# NEXUS — System Architecture

How the whole system fits together, and how the interface is built on top of it.

- **Backend internals** (agent, approval broker, MCP, memory, verification, security model) are documented in depth in [`DECISIONS.md`](DECISIONS.md). This file summarises them where the interface depends on them and links out rather than repeating.
- **This file's focus** is the system as one thing: the request pipeline, how the frontend consumes it, the design system, and — importantly — what is real versus sample data.

Everything below was read out of the code or measured; where something is an assumption or a gap, it says so.

---

## 1. System at a glance

```
 ┌──────────────────────── browser ────────────────────────┐
 │  Next.js 16 · React 19 · Tailwind 4 · React Compiler    │
 │                                                         │
 │   /                landing (server component)           │
 │   /dashboard/*     command center (client app shell)    │
 │   /dashboard/evals eval runs (server component, disk)   │
 └───────┬───────────────────────────────┬─────────────────┘
   REST  │  GET /api/…  POST /api/chat   │ WebSocket /api/ws   (events)
         │                               │              ┌───────────────────────┐
 ┌───────▼───────────────────────────────▼───────┐      │ evals/  (Python CLI)  │
 │ FastAPI backend       127.0.0.1:8000          │◄─────│ drives the backend    │
 │  intent → context → LangGraph agent           │ HTTP │ over HTTP; writes     │
 │  policy → approval broker → verifier          │      │ results/*.json        │
 └───────┬───────────────────────────────────────┘      └──────────┬────────────┘
  MCP over stdio (child process, no socket)                         │ read from disk
 ┌───────▼───────────────────┐        ┌──────────────┐     (server-side, by the
 │ nexus-mac-mcp  (25 tools) │        │ Model API    │      /dashboard/evals page)
 │ macOS · ~/.nexus/nexus.db │        │ Groq/Mistral │
 └───────────────────────────┘        └──────────────┘
```

| Project | Role | Boundary |
|---|---|---|
| `backend/` | Orchestrates the agent, owns permissions, emits events | Binds `127.0.0.1`; the only external call is to the model provider |
| `nexus-mac-mcp/` | Performs Mac capabilities | Child process over stdio; **no socket**; never decides permissions |
| `frontend/` | Interface | Reads REST + WebSocket; every action that could change anything is a chat message |
| `evals/` | Quality measurement | External client of the backend; its results never pass through it |

The brand promise — **evidence, not vibes** — is a design constraint on all four: a result is only shown with the evidence behind it, and the interface may not claim more than the backend recorded.

---

## 2. The request pipeline (nine stages)

One request, one direction. The same nine stages are rendered on the landing page tour and on every run card in the dashboard, and both read from one definition: [`frontend/src/lib/pipeline.js`](frontend/src/lib/pipeline.js).

| # | Stage | What it does | Module | Backend events that bound it |
|---|---|---|---|---|
| 1 | **Intent** | Deterministic regex classification — no model call | `backend/app/context/intent.py` | `task_started` → first context event |
| 2 | **Context** | Memories, workspace, Git, processes, recent tasks — gathered per request and capped | `backend/app/context/collector.py` | `memory_retrieved`, `workspace_detected`, `context_collected` |
| 3 | **Agent** | LangGraph chooses among advertised tools, with a hard step limit | `backend/app/agent/graph.py` | `context_collected` → first `tool_requested` |
| 4 | **Policy** | SAFE runs, CONFIRM stops, RESTRICTED never runs; unclassified = RESTRICTED | `backend/app/tools/permissions.py` | `tool_requested` (carries `permission`) |
| 5 | **Approval** | Tool node blocks until a person answers; covers one call, never persists | `backend/app/agent/approvals.py` | `permission_required` → `tool_started` |
| 6 | **MCP** | JSON-RPC over stdio to the Mac server | `backend/app/mcp/client.py` | `tool_started` → `tool_completed` |
| 7 | **macOS** | Thin adapters behind filesystem/command policies | `nexus-mac-mcp/src/nexus_mac_mcp/core/` | same window as MCP |
| 8 | **Verify** | Independent re-check using SAFE tools only | `backend/app/verification/verifier.py` | `verification_started` → `verification_completed` |
| 9 | **Outcome** | `SUCCESS` / `PARTIAL_SUCCESS` / `FAILED` / `UNKNOWN`, evidence marked `OBSERVED` or `INFERRED` | `backend/app/verification/outcomes.py` | `task_completed` / `task_error` |

Events are emitted *as they happen* (not returned from graph nodes), because a node blocked on an approval has not returned — see "Why events are emitted, not returned" in `DECISIONS.md`. That property is what makes a live run card possible at all.

**What the backend does not record** (so the UI does not pretend): Intent and Policy have no start/end events — their timing is bounded by the events either side; tool *arguments* for SAFE tools are never in any event (arguments are only exposed on the approval request, which is why the macOS stage shows them only for CONFIRM tools and otherwise says "not recorded for this tier").

---

## 3. Frontend architecture

### 3.1 Stack and layout

Next.js 16.3 (App Router, Turbopack), React 19.2 with the React Compiler enabled, Tailwind 4 for utilities and plain CSS with tokens for everything else. JavaScript, not TypeScript (the existing convention). AGENTS.md notes this Next.js has breaking changes; the pieces relied on here — `<ViewTransition>` from `react`, `connection()`, `next/dynamic`-free client islands — were read from `node_modules/next/dist/docs/` first.

```
frontend/src
├─ app/
│  ├─ layout.js            fonts, theme no-flash script, <ViewTransition>
│  ├─ tokens.css           ALL design tokens (light + dark)         ← §4
│  ├─ globals.css          base, type scale, landing styles
│  ├─ ui.css               primitives (buttons, tabs, table, drawer…)
│  ├─ shell.css            app shell + every dashboard view
│  ├─ page.js              landing (server component)
│  ├─ evals/page.js        redirect → /dashboard/evals
│  ├─ dashboard/
│  │   ├─ layout.js        <NexusProvider><AppShell>  (mounted once)
│  │   └─ {page,approvals,timeline,context,memory,processes,git,tools,evals,audit,settings}
│  └─ components/
│      ├─ ui/              primitives.js (server-safe) · interactive.js · extras.js · icons.js
│      ├─ shell/           NexusProvider · AppShell · CommandPalette · Toaster · nav · Page
│      ├─ run/             PipelineTrack · RunCard         (the 9-stage run card)
│      ├─ approvals/       ApprovalCard
│      ├─ views/           one file per dashboard view
│      ├─ evals/           EvalsView (server component)
│      └─ landing/         hero preview, pipeline tour, eval terminal, motion hooks
└─ lib/
   ├─ useNexus.js          the live connection (REST + WebSocket)
   ├─ mock/                SAMPLE-DATA ADAPTER: fixtures.js · demo.js     ← §6
   ├─ runs.js              events → 9-stage run model; audit rows
   ├─ pipeline.js          the nine stages (shared with the landing page)
   ├─ api.js · evals.js    REST client · eval-results reader (server only)
   └─ theme.js · prefs.js · hotkeys.js · useNow.js
```

### 3.2 Routes

| Route | Rendering | What it is |
|---|---|---|
| `/` | static | Landing |
| `/dashboard` | client | **Command** — conversation + live pipeline run cards + right rail |
| `/dashboard/approvals` | client | Inbox of pending decisions (A / D / E, J / K) |
| `/dashboard/timeline` | client | Filterable run history; `?run=<task id>` opens the run drawer |
| `/dashboard/context` | client | What NEXUS sees, plus the raw bundle the agent receives |
| `/dashboard/memory` | client | Browse / search / inspect / act on remembered facts |
| `/dashboard/processes` | client | Managed processes and health |
| `/dashboard/git` | client | Branch, working tree, recent commits |
| `/dashboard/tools` | client | Tool registry with permission tier, calls, success rate |
| `/dashboard/evals` | dynamic (server) | Eval runs read from `evals/results/*.json` |
| `/dashboard/audit` | client | Every policy decision, approval, tool call, verification |
| `/dashboard/settings` | client | Theme, data source, shortcuts |
| `/evals` | server | Redirects to `/dashboard/evals` (old links keep working) |

The shell lives in `dashboard/layout.js`, so the WebSocket, run history and any pending approval **persist while moving between views**. Landing ⇄ dashboard and view ⇄ view transitions use React's `<ViewTransition>` (no configuration in the App Router).

### 3.3 Data flow

```
                       ┌────────── useNexus() ──────────┐   REST = authoritative (on load + every reconnect)
   backend ───────────►│ REST + WebSocket, reconciled   │   WebSocket = incremental events
                       └───────────────┬────────────────┘   context is the one thing polled (15 s)
                                       │            same return shape
                       ┌───────────────┴────────────────┐
   sample data ───────►│ useDemoNexus()  (mock adapter) │
                       └───────────────┬────────────────┘
                                       ▼
                              NexusProvider  ── picks the source (§3.4)
                                       │   folds events into runs (lib/runs.js)
                                       │   history, toasts, tool stats, approvals cache
                                       ▼
                    useApp() → views  (views never branch on the source)
```

**Reconciliation rule** (from `useNexus.js`, kept as-is): REST is authoritative; the WebSocket is incremental; the backend is always the source of truth; the frontend holds no state the backend owns except the conversation transcript.

### 3.4 Choosing the data source

Settings → *Data source*:

| Mode | Behaviour |
|---|---|
| **Auto** (default) | Live data. Falls back to sample data *only while the backend is unreachable*, and returns to live by itself when it answers |
| **Live only** | Never simulates |
| **Sample data** | Always the simulated environment |

A constant-height **status strip** under the top bar always says which one you are looking at (`Connecting…` → `Live 127.0.0.1:8000 · 25 tools` or `Sample data …`). It is constant-height on purpose: an earlier version inserted a banner after the first failed fetch and caused a 0.28 layout shift. Sample data is the loudest state deliberately — nobody should mistake a simulation for a result. The strip is replaced on `/dashboard/evals` with a note that those results come from files on disk, because "sample data" would be false there.

### 3.5 The run model (`lib/runs.js`)

`buildRun({ taskId, events, status, approvals, … })` is a **pure function** of a task's `ExecutionEvent`s. It produces the nine stages, each with a state (`pending | running | done | block | failed | skipped`), a duration where the events allow one, a one-line summary, and a list of details. The same function feeds:

- the live **run card** in Command (events from the WebSocket),
- the **timeline** and **drawer** (events from `GET /api/tasks/{id}`),
- the **audit log** (`auditRows(runs)`),
- **tool stats** (calls / success / last used, derived from the runs it can see).

Because it is derived, nothing here can be more optimistic than what was recorded. Denied approvals are inferred, not recorded: a tool that was asked about and *never started* once the run is over is "denied".

### 3.6 Actions: everything that could change something goes through chat

The backend deliberately has **no** `restart`, `forget` or `edit-memory` endpoint — those are CONFIRM tools, and a second route to the same effect would bypass the approval broker. The dashboard honours that: every such button sends an ordinary chat message via `ask()` in `NexusProvider`, then the request stops at the approval prompt like any other.

| UI action | What it actually does | Tier |
|---|---|---|
| Processes → Restart / Start / Stop | chat: *"Restart the backend process"* | CONFIRM → approval |
| Processes → Logs / Check health | chat | SAFE → runs |
| Memory → Forget | chat: *`Forget the memory "key".`* | CONFIRM → approval (diff preview) |
| Memory → Edit value | chat: *"Update memory key to value"* | CONFIRM → approval (before/after diff) |
| Memory → Verify now | chat | SAFE → runs |
| Memory → Pin | `localStorage` only — the backend has no pinning | n/a (local) |
| Approvals → Approve / Deny | `POST /api/permissions/{id}/approve\|deny` | the one direct write |
| Approvals → **Edit scope** | Denies this call, then re-asks with your limits appended. There is no endpoint that edits a call in place | deny + new chat |
| Suggestion → accept | sends the suggestion's own `prompt` to `/api/chat` | as typed |

### 3.7 Approvals UX

The approval card shows what will happen in the backend's own terms and adds nothing — "this is safe" would be the frontend inventing a guarantee. It shows: a **risk level** (a presentation of the tier — `riskOf()` in `runs.js`, a frontend heuristic, not a backend field), a **preview shaped like the change** (a command as a terminal line, a memory edit as a `−/+` diff, a stop as `RUNNING → STOPPED`), and the evidence (what you asked, the policy and its reason, where).

Keyboard: **A** approve · **D** deny · **E** edit scope · **J/K** (or ↑/↓) move · **/** focus the composer · **⌘K** palette. Single-key shortcuts never fire while a text field has focus or a dialog is open. The composer releases focus after sending so **A** works immediately — an early version kept focus and typed an "a" instead (found by driving the flow in a browser).

### 3.8 Evals view

Server component, rendered per request (`connection()`), reading `evals/results/*.json` (`nexus-evals/v1` envelopes) via `lib/evals.js` — the harness is an external client, so its results never pass through the backend and this page shows exactly the files the CLI wrote. Per run: pass rate, overall quality, flaky count, **latency p50** (median of per-case p50s), each with a trend sparkline across runs of the same dataset; a score breakdown; a **regression diff** (the harness's own `comparison` if present, otherwise computed against the previous run of the same dataset); and a per-case table with a quality sparkline, verdict, trials and p50.

---

## 4. Design system

### 4.1 Tokens (`app/tokens.css`)

One file defines every colour, radius, shadow, duration and type size, for two themes. Components never hold a literal.

- **Light** is white + indigo. **Dark** keys off `[data-theme="dark"]` on `<html>`, set by an inline script in `<head>` *before first paint* (no flash). Preference is `system | light | dark`, stored in `localStorage` (`nexus-theme`), toggled from the top bar and Settings.
- **The terminal is the one dark object in both themes** and is always the same navy (`--term-*`). That is what makes it read as "the machine". Dark cards on light sections (terminal, code blocks, the user's chat bubble, the stage-detail card) all use it.
- **Accent** is one indigo → violet gradient. It marks what you can act on, what has focus, and what is live.
- **Meaning** colours have two values each — a saturated one for indicators (dots, edges) and a darker one for text (`--ok-ink`, `--warn-ink`, `--danger-ink`).
- Old names (`--ink-3`, `--dk-*`) are kept as aliases so earlier components keep working.

**Contrast (WCAG AA, 4.5:1) — verified, not assumed.** `ink-3` (muted text and mono labels) was `#94a3b8` = **2.56:1 on white** and failed everywhere; it is now `#5b6b82` (≥ 4.7:1 on every light surface, ≥ 5.2:1 in dark). All text pairs in both themes were computed; white on the accent gradient is 4.6–5.8. `ink-4` is decorative only and never used for text. After the work, axe-core reports **0 violations on all 12 pages in both themes** (axe in dark mode caught a real bug Lighthouse's light run could not: the closing CTA's button text was invisible, 1.07:1).

### 4.2 Typography

Inter for UI, Geist Mono for system data (paths, ids, tool names, ports). Scale tokens: `display` (clamp 40→68px, −0.045em) · `h1` · `h2` · `h3` · `body` 15px · `lead` 17px · `caption` 13px · `mono-label` 12px. Mono labels have a 12px floor and the AA muted colour. The hero's rotating word sits on **its own centred line** in a fixed-width slot (the widest word reserves the width), so it can neither jump nor leave a gap; its gradient moves continuously (`background-position` over a seamless A→B→A gradient).

### 4.3 Spacing, radii, depth

4/8px grid. Radii: 8 controls · 12 cards · 16 panels · 24 hero cards. Shadows are `sm | md | lg | xl`, heavier in dark. Hierarchy comes from one step in surface colour and a hairline, not from shadows.

### 4.4 Motion

Purposeful: motion explains what the system is doing. `transform`/`opacity` only (plus `background-position` on a few small gradient texts). Every loop pauses off screen (`useInView`); `prefers-reduced-motion` stops them all and shows finished states (verified: reduced-motion landing renders the complete eval terminal). Inventory:

| Where | What |
|---|---|
| Hero | staggered load-in; aurora + grid; cursor-follow spotlight; live-typed product mock (prompt → context chips pop in → reply streams → approval card → Approve pulses → cursor presses); parallax (scroll-driven CSS) |
| How it works | 9-stage tour: node glows, rail fills, a packet rides the rail, detail card swaps, per-stage file path, tour progress, pause on hover/focus |
| Eval terminal | line-by-line replay; ✓ pops in per case; quality bars fill; the flaky `memory_recall` row pulses amber |
| Micro | magnetic primary buttons, hover-lift cards, nudging arrows, count-ups, skeleton shimmer, animated status dots, scroll-progress bar in the nav |
| Dashboard | the active run-card node breathes, the packet rides the rail, an approval node pulses amber, toasts/drawers/palette spring in, route crossfades |

### 4.5 Components

`Button · Card · Badge · StatusDot · Kbd · Skeleton · EmptyState · ErrorState · Table · Terminal · Stepper · Sparkline` (server-safe, `ui/primitives.js`) and `Tabs · Drawer · Magnetic · useTween` (`ui/interactive.js`), plus `Segmented · SearchField · Stat · KeyRow` (`ui/extras.js`). The domain components are `PipelineTrack`, `RunCard`, `ApprovalCard`, `CommandPalette`, `Toaster`.

### 4.6 Accessibility

Focus rings on every interactive element; skip link; semantic tables with captions; `Drawer`, the mobile nav sheet and the palette are native `<dialog>`s (focus trap, Esc, inert background); `Tabs` and the pipeline track implement the ARIA tabs pattern (roving tabindex, arrows, Home/End) and the stepper exposes state to screen readers; the palette is a combobox/listbox; toasts are a polite live region; scrollable regions are keyboard-focusable.

---

## 5. The landing page

Server component with small client islands. Decision on the section the brief flagged: **"How it works" is light, on a faint indigo-tinted band with soft gradient edges — only the stage-detail card is dark** (option *a*). The hard navy block read as a different site; one hue with a single dark object per section fixes the seam and makes dark mode a token swap. Product numbers are read out of the code (25 tools, 19 SAFE, 6 CONFIRM); anything illustrative is captioned as such.

---

## 6. Real versus sample data

| Surface | Source today |
|---|---|
| Command: conversation, run card, approvals, rail | **Live** (REST + WS). Sample data only when the backend is unreachable |
| Run card stages | **Derived from real events**; Intent/Policy timing and SAFE-tool args are the documented gaps (§2) |
| Approvals | **Live** `GET /api/permissions/pending`, `POST …/approve\|deny`. *Risk level* is a frontend heuristic. *Edit scope* is deny + re-ask |
| Timeline / drawer | **Live** `/api/tasks`, `/api/tasks/{id}`; before/after from `/api/tasks/{id}/trace` |
| Context · Git · Processes | **Live** `/api/context` (workspaces, processes, machine) |
| Memory | **Live read** `/api/memory`. Pin is local. Edit/Forget/Verify via chat. "Source" is **not in the API** — live shows "not recorded by the backend" |
| Tools | **Live** `/api/tools`, `/api/mcp/servers`. Calls / success / last-used are **derived from the runs visible** (≤ 40 loaded) — not a metrics service |
| Audit log | Derived from runs. Read-only by construction |
| Evals | **Real**, read from disk server-side |
| Settings | Local (`localStorage`) |
| **Sample-data adapter** | `lib/mock/fixtures.js` (invented, in the real API shapes) + `lib/mock/demo.js` (simulates a run by emitting real-shaped events, pausing at CONFIRM tools). Replies are templates picked by keyword — it is **not a model**. Always behind the status strip |

**Verification status.** The live path was exercised against the real backend started locally (read-only: `/health`, `/api/tools` → 25 tools 19/6/0, `/api/mcp/servers` → connected, `/api/context`, `/api/memory`, `/api/tasks`, `/api/permissions/pending`, plus the WebSocket): the strip read *Live*, tools and empty states rendered correctly, no console errors. **Not exercised against the live backend:** an actual chat → approval → verification run (it would call the external model with the configured API keys, so it was deliberately not triggered). That path is covered by the sample-data adapter, which emits the same event shapes, and by reading the backend's event definitions — but a live end-to-end run is the first thing worth doing next.

---

## 7. Performance

Lighthouse on a production build (`next build && next start`), headless Chrome:

| Page | Perf | A11y | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Landing, desktop | 100 | 100 | 100 | 100 | 0.7 s | 0 |
| Landing, mobile | 92 | 100 | 100 | 100 | 3.4 s | 0.002 |
| Dashboard, desktop | 98 | 100 | 96* | 100 | 0.9 s | 0.085 |
| Dashboard, mobile | 96 | 100 | 96* | 100 | 2.8 s | 0.006 |
| Timeline, desktop | 98 | 100 | 96* | 100 | 1.1 s | 0.002 |

\* The 96 is console errors from the backend being offline during that run (`ERR_CONNECTION_REFUSED`), which is the correct behaviour for an unreachable backend.

Layout shift was found and fixed twice: the post-fetch banner (0.28 → strip) and the welcome card grid moving when the tool count arrived (0.13 → 0.085, by reserving that line). Heavy motion is client islands that pause off screen; the landing page is otherwise server-rendered.

---

## 8. Extending it

- **Add a dashboard view** — add a `NAV` entry in `shell/nav.js`, a `dashboard/<name>/page.js` rendering a component from `components/views/`, and wrap it in `<Page>`. Read everything through `useApp()`.
- **Replace sample data with a real endpoint** — the adapter returns the same shape as the API, so: add the call to `lib/api.js`, fetch it in `useNexus`/`NexusProvider`, and delete the matching fixture. Views don't change.
- **Add or reorder a pipeline stage** — edit `lib/pipeline.js` (shared by the landing tour and the run card) and the stage derivation in `lib/runs.js`.
- **Change a colour** — edit `tokens.css` only, then re-check contrast (the header lists what was measured).

## 9. Running and checking it

```bash
# backend (needs a model key in backend/.env for chat; reads work without)
cd backend && uv sync && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
# frontend
cd frontend && npm install && npm run dev          # http://localhost:3000
npx eslint src                                     # lint (includes React Compiler rules)
npx next build                                     # production build; 13 routes
# no backend? the dashboard shows the sample-data environment automatically
```

## 10. Known limitations and next steps

- **Live end-to-end run not exercised** (see §6) — do one with a real model key and a CONFIRM tool.
- **History is bounded and in-memory on the backend** (tasks, observations, pending approvals reset on restart; traces are capped), so Timeline/Audit/Tool stats only reflect what the backend still holds.
- **No server-side tool metrics, process-restart, memory-edit/pin, or edit-in-place approval endpoints.** The UI routes around them honestly (chat → approval); adding real endpoints would be a backend decision with security implications, not a frontend one.
- **Risk levels** are a presentation heuristic in `riskOf()`; if the backend ever classifies risk, read it from there.
- Dashboard CLS is 0.085 — good, but the rail's late content could be reserved further.
- Stage durations for Intent/Policy are bounded by neighbouring events rather than measured; per-stage timing events in the backend would make them exact.
- The landing page's product mock and eval-terminal numbers are illustrative and captioned as such.
