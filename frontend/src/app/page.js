import Link from "next/link";
import { ProductPreview } from "./components/landing/ProductPreview";
import { Reveal } from "./components/landing/Reveal";
import { Pipeline } from "./components/landing/Pipeline";
import { PermissionExplorer } from "./components/landing/PermissionExplorer";
import { HarnessTerminal } from "./components/landing/HarnessTerminal";
import { ThemeToggle } from "./components/ThemeToggle";
import { Magnetic } from "./components/ui/interactive";
import { BrandMark } from "./components/ui/BrandMark";
import {
  CopyButton,
  CountUp,
  RotatingWord,
  SpotlightGroup,
} from "./components/landing/widgets";

/**
 * The landing page.
 *
 * Product-grade presentation for a product with no seats, no billing and no
 * account: every number on this page is read out of the code (25 tools, 19
 * SAFE, 6 CONFIRM), every stage in the pipeline names the file that runs it,
 * and anything illustrative is captioned as such. A local tool earns trust by
 * being checkable, so the page is built to be checked.
 *
 * A server component. The motion lives in small client islands that pause
 * off screen and stand still under `prefers-reduced-motion`; the aurora and
 * marquee are pure CSS.
 */

export const metadata = {
  title: "NEXUS.ai — a local AI operating layer for macOS",
  description:
    "NEXUS understands your development environment, remembers what matters, and notices when something changes — without ever acting on your Mac unless you approve it.",
};

const STACK = [
  "LangGraph",
  "Model Context Protocol",
  "FastAPI",
  "Next.js",
  "Python 3.14",
  "SQLite",
  "Langfuse",
  "Groq",
  "Mistral",
  "WebSockets",
];

const STATS = [
  { value: 25, label: "Mac capabilities", note: "discovered over MCP" },
  { value: 19, label: "SAFE tools", note: "read-only, run instantly" },
  { value: 6, label: "CONFIRM tools", note: "stop for you, every time" },
  { value: 0, label: "Network listeners", note: "on the MCP server" },
];

const GUARANTEES = [
  ["Local only", "The backend binds to 127.0.0.1. The model provider is the only external service NEXUS contacts."],
  ["Approval-gated", "Anything that changes your Mac stops for a decision, per call, with the arguments shown."],
  ["Suggestions can't execute", "A suggestion has no tool field and no arguments field. Accepting one just sends its text as a chat message."],
  ["No hidden reasoning", "Traces project recorded events and evidence. There's no field that could hold chain-of-thought."],
  ["Confined", "Filesystem and command policies refuse traversal, secret files, pipes and chained shells."],
  ["Bounded", "Context, memory and tool output are capped, so a runaway can't spiral."],
];

const NOT = [
  "Not a remote agent",
  "Not a shell",
  "Not a vector store",
  "Not autonomous",
];

const QUICKSTART = [
  {
    title: "Start the backend",
    body: "It spawns the Mac MCP server itself, over stdio.",
    code: "cd backend && uv sync && cp .env.example .env\nuv run uvicorn app.main:app --host 127.0.0.1 --port 8000",
  },
  {
    title: "Start the dashboard",
    body: "It talks to 127.0.0.1:8000 by default.",
    code: "cd frontend && npm install && npm run dev",
  },
  {
    title: "Measure it",
    body: "Check the harness offline, then run it against the live backend.",
    code: "cd evals && uv sync && uv run pytest\nuv run python -m src --check",
  },
];

const FAQ = [
  [
    "Does my code leave my machine?",
    "Your workspace, files and memory stay local: the backend is bound to loopback and the MCP server has no socket at all. The model provider (Groq or Mistral) receives the conversation and the context gathered for that request, since that is how the model answers.",
  ],
  [
    "Can NEXUS change things on its own?",
    "No. Six tools can change your Mac, and each call to one of them stops at the approval broker until you answer. Approval covers that one call and never persists. Observations and suggestions can't call tools at all.",
  ],
  [
    "What happens with a tool it doesn't recognize?",
    "It's RESTRICTED, which means it never runs. Permission is declared by the MCP server as metadata but decided by the backend's policy, so a new tool can't grant itself access.",
  ],
  [
    "How do I know an action actually worked?",
    "Where a tool declares what success looks like, NEXUS re-checks with SAFE tools and reports SUCCESS, PARTIAL_SUCCESS, FAILED or UNKNOWN, with each piece of evidence marked OBSERVED or INFERRED. A tool returning is not the same as a tool succeeding.",
  ],
  [
    "Does it remember things between sessions?",
    "Yes. Durable facts live in SQLite at ~/.nexus/nexus.db, typed and confidence-scored, and are marked stale when live evidence disagrees. Tasks, observations and pending approvals are in-memory and reset on restart.",
  ],
  [
    "How is quality measured?",
    "An external eval harness drives the live backend over HTTP, scores each case deterministically, repeats trials to catch flaky behaviour, diffs against a baseline to catch regressions, and exports JUnit for CI. Runs are browsable at /evals.",
  ],
];

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={28} />
      <span className="text-[14px] font-bold tracking-[0.12em]">
        NEXUS<span className="text-[var(--accent-ink)]">.ai</span>
      </span>
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden className="arrow-nudge">
      <path
        d="M3.5 8h9M9 4.5L12.5 8 9 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* --- bento visuals: tiny, CSS-only, and each one true to its claim ------- */

function VisualContext() {
  return (
    <div className="bento-visual space-y-1.5" aria-hidden>
      {[
        ["workspace", "distributed-systems-lab"],
        ["branch", "dikshanta"],
        ["changes", "4 files"],
        ["running", "next dev · :3000"],
      ].map(([k, v], i) => (
        <div key={k} className="bento-row" style={{ "--i": i }}>
          <span className="mono text-[11px] text-[var(--ink-3)]">{k}</span>
          <span className="mono text-[11px] text-[var(--ink)]">{v}</span>
        </div>
      ))}
    </div>
  );
}

function VisualMemory() {
  return (
    <div className="bento-visual space-y-1.5" aria-hidden>
      {[
        ["backend port", "8123", 92, "ok"],
        ["test command", "uv run pytest", 78, "ok"],
        ["frontend port", "3001", 34, "warn"],
      ].map(([k, v, c, tone]) => (
        <div key={k}>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium">{k}</span>
            <span className="mono text-[11px] text-[var(--ink-2)]">{v}</span>
          </div>
          <div className="mt-1 h-[4px] overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className={`confidence-fill h-full rounded-full ${tone === "ok" ? "bg-[var(--accent)]" : "bg-[var(--warn)]"}`}
              style={{ "--w": `${c}%` }}
            />
          </div>
        </div>
      ))}
      <p className="mono text-[11px] text-[var(--warn-ink)]">stale · live port is 3000</p>
    </div>
  );
}

function VisualSensors() {
  return (
    <div className="bento-visual flex items-center justify-center" aria-hidden>
      <div className="radar">
        <span className="radar-sweep" />
        <span className="radar-blip" style={{ "--x": "28%", "--y": "34%", "--d": "0s" }} />
        <span className="radar-blip is-warn" style={{ "--x": "66%", "--y": "58%", "--d": "1.1s" }} />
        <span className="radar-blip" style={{ "--x": "44%", "--y": "74%", "--d": "2.2s" }} />
      </div>
    </div>
  );
}

function VisualVerdicts() {
  return (
    <div className="bento-visual flex flex-wrap content-center gap-1.5" aria-hidden>
      {[
        ["SUCCESS", "chip-ok"],
        ["PARTIAL_SUCCESS", "chip-warn"],
        ["FAILED", "chip-danger"],
        ["UNKNOWN", ""],
      ].map(([v, tone], i) => (
        <span key={v} className={`verdict-cycle chip mono !text-[11px] ${tone}`} style={{ "--i": i }}>
          {v}
        </span>
      ))}
    </div>
  );
}

function VisualSuggest() {
  return (
    <div className="bento-visual" aria-hidden>
      <div className="rounded-[10px] border border-[var(--accent-line)] bg-[var(--accent-bg)] p-3">
        <p className="text-[11px] font-semibold text-[var(--accent-ink)]">Suggestion</p>
        <p className="mt-1 text-[11.5px] leading-[1.5]">
          &ldquo;The backend exited with code 143. Want me to restart it?&rdquo;
        </p>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-[6px] bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--on-accent)]">
            Ask to restart
          </span>
          <span className="rounded-[6px] border border-[var(--line-2)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold">
            Dismiss
          </span>
        </div>
      </div>
      <p className="mono mt-2 text-[11px] text-[var(--ink-3)]">{"{ intent, prompt }"} · no tool · no args</p>
    </div>
  );
}

function VisualTrace() {
  return (
    <div className="bento-visual" aria-hidden>
      <ol className="trace-list">
        {[
          ["context_collected", "5 sources"],
          ["tool_started", "git_status"],
          ["tool_completed", "124ms"],
          ["verification_completed", "SUCCESS"],
        ].map(([e, m], i) => (
          <li key={e} style={{ "--i": i }}>
            <span className="mono text-[11px] text-[var(--ink)]">{e}</span>
            <span className="mono text-[11px] text-[var(--ink-3)]">{m}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const BENTO = [
  {
    title: "It knows where you are",
    body: "Active workspace, branch, uncommitted changes and the servers you started, read from your machine rather than guessed.",
    visual: <VisualContext />,
    span: "lg:col-span-2",
  },
  {
    title: "It remembers across sessions",
    body: "Typed, confidence-scored facts in SQLite, marked stale the moment live evidence disagrees.",
    visual: <VisualMemory />,
    span: "",
  },
  {
    title: "It notices on its own",
    body: "Deterministic sensors watch processes, services, Git and memory. No model in the loop.",
    visual: <VisualSensors />,
    span: "",
  },
  {
    title: "It suggests. You decide.",
    body: "A suggestion is only a question. Accepting it sends its text as a chat message you can read first.",
    visual: <VisualSuggest />,
    span: "",
  },
  {
    title: "It checks its own work",
    body: "SUCCESS needs evidence, not just a tool that returned. Four verdicts, never invented certainty.",
    visual: <VisualVerdicts />,
    span: "",
  },
  {
    title: "It shows its receipts",
    body: "Every task has a trace built from what already went out on the WebSocket. It adds no new source of truth.",
    visual: <VisualTrace />,
    span: "lg:col-span-2",
  },
];

export default function Landing() {
  return (
    <div className="premium-landing relative min-h-full overflow-x-clip">
      {/* --- header --------------------------------------------------------- */}
      <header className="premium-nav sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_74%,transparent)] backdrop-blur-[16px]">
        <div aria-hidden className="scroll-progress" />
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link href="/" aria-label="NEXUS.ai home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-0.5" aria-label="Primary">
            {[
              ["#capabilities", "Product"],
              ["#how", "How it works"],
              ["#trust", "Safety"],
              ["#harness", "Evals"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="nav-link hidden md:inline-flex">
                {label}
              </a>
            ))}
            <ThemeToggle className="ml-1" />
            <Magnetic className="ml-1">
              <Link href="/dashboard" className="btn btn-primary">
                Open dashboard
                <ArrowIcon />
              </Link>
            </Magnetic>
          </nav>
        </div>
      </header>

      {/* --- hero ----------------------------------------------------------- */}
      <SpotlightGroup className="relative">
        <section className="hero relative overflow-hidden" data-spotlight>
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="aurora">
              <span className="aurora-blob a" />
              <span className="aurora-blob b" />
              <span className="aurora-blob c" />
            </div>
            <div className="hero-grid" />
            <div className="hero-spot" />
            <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-[var(--bg)]" />
          </div>

          <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-16">
            <div className="mx-auto max-w-4xl text-center">
              <span className="enter chip chip-accent badge-shine mx-auto" style={{ "--i": 0 }}>
                <span className="dot dot-live" />
                Runs entirely on your Mac · no account
              </span>

              <h1 className="enter t-display mt-6 text-balance" style={{ "--i": 1 }}>
                <span className="hero-title">
                  The AI layer that <br className="hidden sm:block" />
                  understands your
                </span>
                <RotatingWord words={["servers.", "repos.", "Mac.", "workflows.", "processes."]} />
              </h1>

              <p
                className="enter t-body mx-auto mt-5 max-w-xl text-pretty sm:text-[1.0625rem]"
                style={{ "--i": 2 }}
              >
                NEXUS reads your environment, remembers what matters across sessions and
                notices when something breaks. Then it waits for your approval before
                changing anything, and shows you the evidence afterwards.
              </p>

              <div
                className="enter mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row"
                style={{ "--i": 3 }}
              >
                <Magnetic className="w-full sm:w-auto">
                  <Link href="/dashboard" className="btn btn-primary btn-lg btn-glow w-full sm:w-auto">
                    Open dashboard
                    <ArrowIcon />
                  </Link>
                </Magnetic>
                <a href="#how" className="btn btn-ghost btn-lg w-full sm:w-auto">
                  See how it works
                </a>
              </div>

              <p className="enter mono mt-5 text-[12px] text-[var(--ink-3)]" style={{ "--i": 4 }}>
                127.0.0.1 · approval-gated · evidence, not vibes
              </p>
            </div>

            <div className="enter mx-auto mt-14 max-w-5xl sm:mt-16" style={{ "--i": 5 }}>
              <ProductPreview />
              <p className="mt-3 text-center text-[12px] text-[var(--ink-3)]">
                Illustrative replay of one request in the NEXUS dashboard.
              </p>
            </div>
          </div>
        </section>
      </SpotlightGroup>

      {/* --- stack marquee -------------------------------------------------- */}
      <section aria-label="Built with" className="border-y border-[var(--line)] bg-[var(--surface)]/60 py-5">
        <div className="marquee" aria-hidden>
          <div className="marquee-track">
            {[...STACK, ...STACK].map((name, i) => (
              <span key={i} className="marquee-item">
                <span className="marquee-dot" />
                {name}
              </span>
            ))}
          </div>
        </div>
        <p className="sr-only">Built with {STACK.join(", ")}.</p>
      </section>

      {/* --- numbers -------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-20">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-xl)] border border-[var(--line)] bg-[var(--line)] lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i} className="bg-[var(--surface)] p-5 sm:p-7">
              <p className="stat-number">
                <CountUp value={s.value} />
              </p>
              <p className="mt-2 text-[0.875rem] font-semibold">{s.label}</p>
              <p className="t-meta mt-0.5">{s.note}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- capabilities bento --------------------------------------------- */}
      <section id="capabilities" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="max-w-2xl">
          <p className="t-label">What it does</p>
          <h2 className="t-h1 mt-3 text-balance">
            Context is the product. Everything else follows from it.
          </h2>
          <p className="t-body mt-4 max-w-xl">
            Most assistants start every conversation from nothing. NEXUS starts from your
            machine and tells you what it looked at.
          </p>
        </Reveal>

        <SpotlightGroup className="bento-group mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BENTO.map((item, index) => (
            <Reveal key={item.title} delay={index % 3} className={`h-full ${item.span}`}>
              <article data-spotlight className="bento card h-full p-5 sm:p-6">
                {item.visual}
                <h3 className="t-h2 mt-5">{item.title}</h3>
                <p className="t-body mt-1.5 !text-[0.84375rem] !leading-[1.6]">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </SpotlightGroup>
      </section>

      {/* --- how it works: light, same hue; only the detail card is dark ----- */}
      <section id="how" className="how-section scroll-mt-14">
        <div aria-hidden className="how-grid" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal className="max-w-2xl">
            <p className="t-label">How it works</p>
            <h2 className="t-h1 mt-3 text-balance">
              The model chooses what to ask for. The backend decides what may run.
            </h2>
            <p className="t-lead mt-4 max-w-xl">
              One request, nine stages, one direction. Routes never call a model or a tool;
              the MCP server never decides permissions. Each stop below names the file that
              does the work.
            </p>
          </Reveal>
          <Reveal className="mt-14">
            <Pipeline />
          </Reveal>
        </div>
      </section>

      {/* --- permissions ---------------------------------------------------- */}
      <section id="trust" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start [&>*]:min-w-0">
          <Reveal>
            <p className="t-label">Safety</p>
            <h2 className="t-h1 mt-3 text-balance">
              It can see a lot. It can change almost nothing.
            </h2>
            <p className="t-body mt-4 max-w-md">
              Reading is free; acting is not. Every tool is classified, and the ones that
              change anything stop for you, every time, with the arguments shown.
            </p>
            <p className="t-body mt-4 max-w-md">
              <strong className="font-semibold text-[var(--ink)]">Proactive never means autonomous.</strong>{" "}
              Between noticing a problem and changing your machine there is always a person.
            </p>
          </Reveal>
          <Reveal delay={1}>
            <PermissionExplorer />
          </Reveal>
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map(([title, body], index) => (
            <Reveal key={title} delay={index % 3}>
              <div className="guarantee border-t border-[var(--line-2)] pt-4">
                <h3 className="text-[0.9375rem] font-semibold">{title}</h3>
                <p className="t-body mt-1.5 !text-[0.84375rem] !leading-[1.6]">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14 flex flex-wrap items-center gap-2">
          <span className="t-label mr-2">Deliberately</span>
          {NOT.map((n) => (
            <span key={n} className="chip">
              {n}
            </span>
          ))}
        </Reveal>
      </section>

      {/* --- eval harness --------------------------------------------------- */}
      <section id="harness" className="scroll-mt-14 border-y border-[var(--line)] bg-[var(--bg-1)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.85fr_1.15fr] lg:items-center [&>*]:min-w-0">
          <Reveal>
            <p className="t-label">Eval harness</p>
            <h2 className="t-h1 mt-3 text-balance">Measured, not claimed.</h2>
            <p className="t-body mt-4 max-w-md">
              A separate harness drives the live backend the way the dashboard does, scores
              every case deterministically and refuses to call a flaky pass a pass.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                ["Repeated trials", "A case passes only if every trial does, and flaky ones get flagged."],
                ["Regression gates", "Diff against a baseline; a case that used to pass fails the build."],
                ["Seven scorers", "Tools, event contract, outcome, keywords, completion, safety, latency."],
                ["CI-ready", "JUnit XML, a quality floor, and Langfuse traces per case."],
              ].map(([t, b], i) => (
                <li key={t} className="feature-row" style={{ "--i": i }}>
                  <span className="feature-check" aria-hidden>
                    <svg width="10" height="10" viewBox="0 0 12 12">
                      <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>
                    <span className="text-[0.875rem] font-semibold">{t}</span>
                    <span className="t-body block !text-[0.8125rem] !leading-[1.55]">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/evals" className="btn btn-ghost mt-8">
              Browse eval runs
              <ArrowIcon />
            </Link>
          </Reveal>
          <Reveal delay={1}>
            <HarnessTerminal />
            <p className="mt-3 text-center text-[12px] text-[var(--ink-3)]">
              Real command and output format; illustrative, abridged numbers.
            </p>
          </Reveal>
        </div>
      </section>

      {/* --- quick start ---------------------------------------------------- */}
      <section id="start" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="max-w-2xl">
          <p className="t-label">Quick start</p>
          <h2 className="t-h1 mt-3">Three terminals and you&rsquo;re running.</h2>
          <p className="t-body mt-4">
            macOS, Python 3.14+, uv, Node.js, and a Groq or Mistral key for a tool-calling model.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-3 lg:grid-cols-3 [&>*]:min-w-0">
          {QUICKSTART.map((step, i) => (
            <Reveal key={step.title} delay={i}>
              <div className="card card-hover flex h-full flex-col p-5">
                <div className="flex items-center gap-2.5">
                  <span className="step-num">{i + 1}</span>
                  <h3 className="t-h2">{step.title}</h3>
                </div>
                <p className="t-meta mt-1.5">{step.body}</p>
                <div className="code-block mt-4 flex-1">
                  <CopyButton text={step.code} />
                  <pre className="mono">
                    {step.code.split("\n").map((line) => (
                      <span key={line} className="block">
                        <span className="select-none text-[var(--dk-ink-3)]">$ </span>
                        {line}
                      </span>
                    ))}
                  </pre>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- faq ------------------------------------------------------------ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-20 sm:px-8 sm:pb-28">
        <Reveal className="text-center">
          <p className="t-label">FAQ</p>
          <h2 className="t-h1 mt-3">Questions worth asking a tool that can see your Mac.</h2>
        </Reveal>
        <div className="mt-10 divide-y divide-[var(--line)] rounded-[var(--r-xl)] border border-[var(--line)] bg-[var(--surface)]">
          {FAQ.map(([q, a], i) => (
            <Reveal key={q} delay={i % 3}>
              <details className="faq group">
                <summary>
                  <span>{q}</span>
                  <span className="faq-icon" aria-hidden />
                </summary>
                <p className="faq-body t-body !text-[0.875rem]">{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- close ---------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 sm:pb-28">
        <Reveal>
          <div className="cta-card relative overflow-hidden rounded-[var(--r-2xl)] px-6 py-16 text-center sm:px-16 sm:py-20">
            <div aria-hidden className="cta-rings">
              <span />
              <span />
              <span />
            </div>
            <div className="relative">
              <h2 className="t-h1 text-balance text-white">Open it and ask where you left off.</h2>
              <p className="mx-auto mt-4 max-w-md text-[0.9375rem] leading-[1.7] text-[var(--dk-ink-2)]">
                The dashboard reads your current workspace the moment it loads.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <Link href="/dashboard" className="btn btn-lg btn-light w-full sm:w-auto">
                  Open dashboard
                  <ArrowIcon />
                </Link>
                <Link href="/dashboard/evals" className="btn btn-lg dk-btn-lg w-full sm:w-auto">
                  View eval runs
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <Logo />
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-[var(--ink-2)]" aria-label="Footer">
            <Link href="/dashboard" className="hover:text-[var(--ink)]">Dashboard</Link>
            <Link href="/dashboard/evals" className="hover:text-[var(--ink)]">Evals</Link>
            <a href="#trust" className="hover:text-[var(--ink)]">Safety</a>
            <a href="#start" className="hover:text-[var(--ink)]">Quick start</a>
          </nav>
          <p className="text-[12px] text-[var(--ink-3)]">A local AI operating layer for macOS.</p>
        </div>
      </footer>
    </div>
  );
}
