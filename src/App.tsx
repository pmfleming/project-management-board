import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";

type DemoId = "console" | "studio" | "signal";
type Tone = "good" | "watch" | "risk" | "info";

type DemoConfig = {
  id: DemoId;
  name: string;
  tagline: string;
};

type Section = {
  id: string;
  label: string;
  index: string;
  count: number;
  tone: Tone;
  shortcut?: string;
};

type ModuleRow = {
  name: string;
  domain: string;
  quality: number;
  capacity: number;
  correctness: number;
  risk: number;
  delta: number;
  hotspots: number;
  loc: number;
};

type DeltaRow = {
  label: string;
  value: string;
  tone: Tone;
  note: string;
};

type RankRow = {
  label: string;
  value: number;
  tone: Tone;
};

type Evidence = {
  eyebrow: string;
  title: string;
  value: string;
  suffix: string;
  detail: string;
};

type Series = {
  label: string;
  values: number[];
  tone: Tone;
};

const demos: DemoConfig[] = [
  { id: "console", name: "Console", tagline: "Dense ops cockpit" },
  { id: "studio", name: "Studio", tagline: "Editorial brief" },
  { id: "signal", name: "Signal", tagline: "Bento dashboard" },
];

const sections: Section[] = [
  { id: "overview", label: "Overview", index: "01", count: 18, tone: "good", shortcut: "G O" },
  { id: "quality", label: "Quality", index: "02", count: 6, tone: "watch", shortcut: "G Q" },
  { id: "performance", label: "Performance", index: "03", count: 3, tone: "risk", shortcut: "G P" },
  { id: "correctness", label: "Correctness", index: "04", count: 9, tone: "good", shortcut: "G C" },
  { id: "telemetry", label: "Telemetry", index: "05", count: 4, tone: "good", shortcut: "G T" },
];

const modulesData: ModuleRow[] = [
  { name: "Runtime", domain: "Core", quality: 62, capacity: 71, correctness: 88, risk: 84, delta: 3.2, hotspots: 14, loc: 18420 },
  { name: "Storage", domain: "Core", quality: 71, capacity: 68, correctness: 91, risk: 72, delta: 1.4, hotspots: 9, loc: 12180 },
  { name: "Search", domain: "Edge", quality: 78, capacity: 73, correctness: 89, risk: 64, delta: -0.6, hotspots: 7, loc: 8930 },
  { name: "Telemetry", domain: "Edge", quality: 91, capacity: 82, correctness: 94, risk: 36, delta: -2.1, hotspots: 3, loc: 6240 },
  { name: "UI", domain: "Surface", quality: 88, capacity: 85, correctness: 93, risk: 41, delta: -1.4, hotspots: 4, loc: 9740 },
  { name: "API", domain: "Surface", quality: 84, capacity: 79, correctness: 92, risk: 48, delta: 0.2, hotspots: 5, loc: 7820 },
];

const trend = {
  quality:     [78, 80, 82, 81, 83, 84, 83, 85, 86, 85, 86, 86],
  capacity:    [82, 80, 78, 77, 75, 74, 73, 74, 73, 72, 74, 74],
  correctness: [89, 90, 91, 91, 92, 93, 93, 93, 94, 94, 94, 94],
  risk:        [42, 38, 36, 32, 30, 28, 26, 24, 22, 20, 19, 18],
};

const weeks = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"];

const codeBreakdown: RankRow[] = [
  { label: "Application", value: 64, tone: "good" },
  { label: "Tests", value: 24, tone: "info" },
  { label: "Tooling", value: 8, tone: "watch" },
  { label: "Other", value: 4, tone: "risk" },
];

const deltas: DeltaRow[] = [
  { label: "Runtime risk", value: "+3.2", tone: "risk", note: "Up against last cycle" },
  { label: "Test coverage", value: "+1.4", tone: "good", note: "Gains from new layers" },
  { label: "Clone debt", value: "-2.1", tone: "good", note: "Two pattern collapses" },
  { label: "Capacity headroom", value: "-3.0", tone: "watch", note: "Search path narrowing" },
];

const riskRanking: RankRow[] = [
  { label: "Runtime", value: 84, tone: "risk" },
  { label: "Storage", value: 72, tone: "watch" },
  { label: "Search", value: 64, tone: "watch" },
  { label: "API", value: 48, tone: "good" },
  { label: "UI", value: 41, tone: "good" },
];

const evidence: Evidence[] = [
  {
    eyebrow: "Module risk",
    title: "Runtime pressure",
    value: "84",
    suffix: "/100",
    detail: "Two hot zones cluster around the request lifecycle. Re-prioritize the queue boundary before the next refactor window.",
  },
  {
    eyebrow: "Capacity",
    title: "Search latency",
    value: "73",
    suffix: "%",
    detail: "Resource headroom is narrowing on filter-heavy queries. Pre-aggregation buys six points without touching the hot path.",
  },
  {
    eyebrow: "Correctness",
    title: "Coverage gap",
    value: "94",
    suffix: "%",
    detail: "Unknown tests cluster in the integration layer. Three targeted layer tests collapse the gap.",
  },
];

const layerMatrix = [
  { name: "App", pass: 184, fail: 0, unknown: 4 },
  { name: "Domain", pass: 312, fail: 1, unknown: 7 },
  { name: "Infra", pass: 96, fail: 3, unknown: 12 },
  { name: "Surface", pass: 142, fail: 0, unknown: 2 },
];

function riskTone(value: number): Tone {
  if (value >= 70) return "risk";
  if (value >= 50) return "watch";
  return "good";
}

function deltaSign(value: number): "up" | "down" | "flat" {
  if (value > 0.05) return "up";
  if (value < -0.05) return "down";
  return "flat";
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/demos" || path.startsWith("/demo")) {
    return <DemoStudio />;
  }
  return <ViewerRedirect />;
}

function ViewerRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("v")) params.set("v", String(Date.now()));
    window.location.replace(`/viewer/?${params.toString()}`);
  }, []);
  return (
    <main className="redirect-shell">
      <div className="redirect-card">
        <p>Opening Project Management Board...</p>
        <a href="/demos">View workbench variants</a>
      </div>
    </main>
  );
}

function DemoStudio() {
  const initial = useMemo<DemoId>(() => {
    const q = new URLSearchParams(window.location.search);
    const requested = q.get("demo") as DemoId | null;
    return requested && demos.some((d) => d.id === requested) ? requested : "console";
  }, []);
  const [active, setActive] = useState<DemoId>(initial);

  const select = (id: DemoId) => {
    setActive(id);
    window.history.replaceState(null, "", `/demos?demo=${id}`);
  };

  return (
    <main className={`demo-shell demo-shell--${active}`}>
      <header className="demo-topbar">
        <a className="demo-brand" href="/viewer/">
          <span className="demo-brand-mark" aria-hidden="true">PM</span>
          <span className="demo-brand-name">
            Project Management Board
            <em>Workbench rail · 3 variants</em>
          </span>
        </a>
        <nav className="demo-switcher" aria-label="Workbench variants">
          {demos.map((demo) => (
            <button
              key={demo.id}
              type="button"
              className={demo.id === active ? "is-active" : ""}
              onClick={() => select(demo.id)}
            >
              <strong>{demo.name}</strong>
              <em>{demo.tagline}</em>
            </button>
          ))}
        </nav>
      </header>

      {active === "console" && <ConsoleVariant />}
      {active === "studio" && <StudioVariant />}
      {active === "signal" && <SignalVariant />}
    </main>
  );
}

/* ===== Console: dense ops cockpit ===== */

function ConsoleVariant() {
  return (
    <section className="console-shell" aria-label="Console workbench variant">
      <ConsoleRail />
      <div className="console-focus">
        <header className="console-header">
          <p className="eyebrow">Architecture review · Q2</p>
          <h1>Overview</h1>
          <div className="console-header-meta">
            <span>Build <em>487</em></span>
            <span>Updated <em>2 h ago</em></span>
            <span>Metrics <em>18</em></span>
            <span>Risk items <em>3</em></span>
          </div>
        </header>

        <div className="console-stats">
          <StatTile label="Quality" value="86" suffix="%" tone="good" delta={1.4} sparkline={trend.quality} />
          <StatTile label="Capacity" value="74" suffix="%" tone="watch" delta={-3.0} sparkline={trend.capacity} preferLow />
          <StatTile label="Correctness" value="94" suffix="%" tone="good" delta={0.0} sparkline={trend.correctness} />
          <StatTile label="Open risks" value="18" tone="risk" delta={-2.0} sparkline={trend.risk} preferLow />
        </div>

        <article className="console-chart">
          <header>
            <h2>Risk trend</h2>
            <span>12 weeks · all modules</span>
          </header>
          <LineChart
            labels={weeks}
            series={[
              { label: "Quality", values: trend.quality, tone: "good" },
              { label: "Capacity", values: trend.capacity, tone: "watch" },
              { label: "Correctness", values: trend.correctness, tone: "info" },
              { label: "Risk", values: trend.risk, tone: "risk" },
            ]}
          />
          <footer className="chart-legend">
            <span><i className="dot dot--good" /> Quality</span>
            <span><i className="dot dot--watch" /> Capacity</span>
            <span><i className="dot dot--info" /> Correctness</span>
            <span><i className="dot dot--risk" /> Risk</span>
          </footer>
        </article>

        <article className="console-table">
          <header>
            <h2>Modules</h2>
            <span>Top 6 by total risk</span>
          </header>
          <div className="data-table">
            <div className="data-table-head">
              <span>Module</span>
              <span>Domain</span>
              <span>Quality</span>
              <span>Capacity</span>
              <span>Correctness</span>
              <span>Hotspots</span>
              <span>Risk</span>
              <span>Δ</span>
            </div>
            {modulesData.map((row) => (
              <div className="data-table-row" key={row.name}>
                <span><strong>{row.name}</strong></span>
                <span className="muted">{row.domain}</span>
                <span className="num">{row.quality}</span>
                <span className="num">{row.capacity}</span>
                <span className="num">{row.correctness}</span>
                <span className="num">{row.hotspots}</span>
                <span><i className={`risk-pill risk-pill--${riskTone(row.risk)}`}>{row.risk}</i></span>
                <span className={`delta-tag delta-tag--${deltaSign(row.delta)}`}>
                  {row.delta > 0 ? "+" : ""}
                  {row.delta.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <ConsoleDetail />
    </section>
  );
}

function ConsoleRail() {
  return (
    <aside className="console-rail">
      <div className="console-rail-brand">
        <strong>PM</strong>
        <span>Architecture<br />review · Q2</span>
      </div>
      <div className="console-rail-section">
        <p>Views</p>
        <ul>
          {sections.map((s) => (
            <li key={s.id} className={s.id === "overview" ? "is-active" : ""}>
              <em>{s.index}</em>
              <span>{s.label}</span>
              <i className={`tag tag--${s.tone}`}>{s.count}</i>
            </li>
          ))}
        </ul>
      </div>
      <div className="console-rail-section">
        <p>Shortcuts</p>
        <ul className="console-rail-shortcuts">
          {sections.map((s) =>
            s.shortcut ? (
              <li key={s.id}>
                <kbd>{s.shortcut}</kbd>
                <span>{s.label}</span>
              </li>
            ) : null,
          )}
        </ul>
      </div>
      <footer className="console-rail-foot">
        <span>build</span>
        <em>487 · v0.4.2</em>
      </footer>
    </aside>
  );
}

function ConsoleDetail() {
  return (
    <aside className="console-detail">
      <section>
        <h3>Latest deltas</h3>
        <ul className="delta-list">
          {deltas.map((d) => (
            <li key={d.label} className={`delta-list-item delta-list-item--${d.tone}`}>
              <span>{d.label}</span>
              <strong>{d.value}</strong>
              <em>{d.note}</em>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Risk ranking</h3>
        <ul className="rank-list">
          {riskRanking.map((r) => (
            <li key={r.label}>
              <span>{r.label}</span>
              <i
                className={`rank-bar rank-bar--${r.tone}`}
                style={{ "--width": `${r.value}%` } as React.CSSProperties}
              />
              <strong>{r.value}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section className="console-action">
        <h3>Next action</h3>
        <p>Open Runtime to triage two hot zones in the request lifecycle. Capacity headroom is the second priority.</p>
        <div className="action-buttons">
          <button type="button" className="btn btn--primary">Open Runtime →</button>
          <button type="button" className="btn">Compare capacity</button>
        </div>
      </section>
    </aside>
  );
}

function StatTile({
  label,
  value,
  suffix,
  tone,
  delta,
  sparkline,
  preferLow,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone: Tone;
  delta: number;
  sparkline: number[];
  preferLow?: boolean;
}) {
  const sign = deltaSign(delta);
  const isGood =
    sign === "flat" || (preferLow ? sign === "down" : sign === "up");
  const arrowTone = sign === "flat" ? "flat" : isGood ? "up" : "down";
  return (
    <article className={`stat-tile stat-tile--${tone}`}>
      <p>{label}</p>
      <strong>
        <span>{value}</span>
        {suffix ? <em>{suffix}</em> : null}
      </strong>
      <Sparkline values={sparkline} tone={tone} />
      <div className="stat-tile-foot">
        <span className={`delta-tag delta-tag--${arrowTone}`}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}
        </span>
        <span className="muted">vs last cycle</span>
      </div>
    </article>
  );
}

/* ===== Studio: editorial brief ===== */

function StudioVariant() {
  return (
    <section className="studio-shell" aria-label="Studio workbench variant">
      <StudioRail />
      <div className="studio-focus">
        <header className="studio-hero">
          <span className="studio-eyebrow">Release brief · build 487</span>
          <h1>
            Build 487 is ready to ship — <span>with one caveat</span>.
          </h1>
          <p className="studio-lead">
            Three quarters of the spine looks confident: tests are dense, capacity holds, surfaces stay tight. Runtime alone is asking for a focused remediation window before the next broad refactor.
          </p>
          <div className="studio-hero-stats">
            <StudioStat label="Confidence" value="82" suffix="/100" tone="good" />
            <StudioStat label="Hot zones" value="2" tone="risk" />
            <StudioStat label="Modules clear" value="4 of 6" tone="info" />
          </div>
        </header>

        <article className="studio-chart">
          <header>
            <span className="studio-eyebrow">12-week trend</span>
            <h2>Quality holds, capacity narrows.</h2>
          </header>
          <AreaChart
            labels={weeks}
            series={[
              { label: "Quality", values: trend.quality, tone: "good" },
              { label: "Capacity", values: trend.capacity, tone: "watch" },
            ]}
          />
          <footer className="chart-legend">
            <span><i className="dot dot--good" /> Quality index · 86</span>
            <span><i className="dot dot--watch" /> Capacity headroom · 74</span>
          </footer>
        </article>

        <div className="studio-evidence">
          <header>
            <span className="studio-eyebrow">Evidence</span>
            <h2>Where the story sharpens.</h2>
          </header>
          <div className="studio-evidence-grid">
            {evidence.map((item) => (
              <article key={item.title} className="studio-evidence-card">
                <span className="studio-eyebrow">{item.eyebrow}</span>
                <strong>
                  <span>{item.value}</span>
                  <em>{item.suffix}</em>
                </strong>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <StudioDetail />
    </section>
  );
}

function StudioRail() {
  return (
    <aside className="studio-rail">
      <a className="studio-rail-brand" href="/viewer/" aria-label="Home">
        PM
      </a>
      <ul>
        {sections.map((s) => (
          <li key={s.id} className={s.id === "overview" ? "is-active" : ""}>
            <em>{s.index}</em>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
      <footer>
        <p>Confidence</p>
        <strong>82</strong>
      </footer>
    </aside>
  );
}

function StudioStat({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone: Tone;
}) {
  return (
    <div className={`studio-stat studio-stat--${tone}`}>
      <p>{label}</p>
      <strong>
        <span>{value}</span>
        {suffix ? <em>{suffix}</em> : null}
      </strong>
    </div>
  );
}

function StudioDetail() {
  return (
    <aside className="studio-detail">
      <section className="studio-verdict">
        <span className="studio-eyebrow">Verdict</span>
        <strong>82</strong>
        <span className="studio-verdict-label">confidence</span>
      </section>
      <section>
        <h3>Top concerns</h3>
        <ul className="studio-concerns">
          {riskRanking.slice(0, 4).map((r) => (
            <li key={r.label} className={`studio-concern studio-concern--${r.tone}`}>
              <span>{r.label}</span>
              <strong>{r.value}</strong>
              <i
                className={`rank-bar rank-bar--${r.tone}`}
                style={{ "--width": `${r.value}%` } as React.CSSProperties}
              />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Recommendation</h3>
        <p>Hold the next broad refactor until Runtime pressure drops below 70. Pre-aggregation on Search will buy capacity in the same window.</p>
        <button type="button" className="btn btn--primary studio-btn">Open recommendation →</button>
      </section>
    </aside>
  );
}

/* ===== Signal: bento dashboard ===== */

function SignalVariant() {
  const totalTests = layerMatrix.reduce((s, l) => s + l.pass + l.fail + l.unknown, 0);
  return (
    <section className="signal-shell" aria-label="Signal workbench variant">
      <SignalRail />
      <div className="signal-canvas">
        <article className="signal-tile signal-tile--quality">
          <header>
            <span>Quality index</span>
            <em>12-week trend</em>
          </header>
          <strong>
            <span>86</span>
            <em>%</em>
          </strong>
          <span className="signal-delta signal-delta--up">▲ 1.4 vs last cycle</span>
          <AreaChart
            labels={weeks}
            series={[{ label: "Quality", values: trend.quality, tone: "good" }]}
            compact
          />
        </article>

        <article className="signal-tile signal-tile--donut">
          <header>
            <span>Module status</span>
            <em>6 modules</em>
          </header>
          <Donut
            items={[
              { label: "Risk", value: 1, tone: "risk" },
              { label: "Watch", value: 2, tone: "watch" },
              { label: "Good", value: 3, tone: "good" },
            ]}
            centerNum={6}
            centerLabel="modules"
          />
          <ul className="signal-legend">
            <li><i className="dot dot--risk" /><span>Risk</span><strong>1</strong></li>
            <li><i className="dot dot--watch" /><span>Watch</span><strong>2</strong></li>
            <li><i className="dot dot--good" /><span>Good</span><strong>3</strong></li>
          </ul>
        </article>

        <article className="signal-tile signal-tile--accent">
          <header>
            <span>Open risks</span>
            <em>vs last cycle</em>
          </header>
          <strong>
            <span>18</span>
          </strong>
          <span className="signal-delta signal-delta--down">▼ 2 vs last cycle</span>
          <Sparkline values={trend.risk} tone="risk" />
        </article>

        <article className="signal-tile signal-tile--code">
          <header>
            <span>Code distribution</span>
            <em>Lines of Rust</em>
          </header>
          <ul className="signal-bars">
            {codeBreakdown.map((c) => (
              <li key={c.label}>
                <span>{c.label}</span>
                <i
                  className={`bar bar--${c.tone}`}
                  style={{ "--width": `${c.value}%` } as React.CSSProperties}
                />
                <strong>{c.value}%</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="signal-tile signal-tile--layers">
          <header>
            <span>Correctness · layers</span>
            <em>{totalTests} tests</em>
          </header>
          <div className="signal-layer-grid">
            {layerMatrix.map((layer) => {
              const total = layer.pass + layer.fail + layer.unknown;
              return (
                <div className="signal-layer" key={layer.name}>
                  <strong>{layer.name}</strong>
                  <div className="signal-layer-bars">
                    <i
                      className="bar bar--good"
                      style={{ "--width": `${(layer.pass / total) * 100}%` } as React.CSSProperties}
                    />
                    <i
                      className="bar bar--risk"
                      style={{ "--width": `${(layer.fail / total) * 100}%` } as React.CSSProperties}
                    />
                    <i
                      className="bar bar--watch"
                      style={{ "--width": `${(layer.unknown / total) * 100}%` } as React.CSSProperties}
                    />
                  </div>
                  <span>
                    {layer.pass} pass · {layer.fail} fail · {layer.unknown} unknown
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="signal-tile signal-tile--velocity">
          <header>
            <span>Streams</span>
            <em>Active analysis</em>
          </header>
          <strong>
            <span>5</span>
            <em>live</em>
          </strong>
          <ul className="signal-mini">
            <li><span>Quality</span><strong>2.1 s</strong></li>
            <li><span>Capacity</span><strong>5.8 s</strong></li>
            <li><span>Telemetry</span><strong>0.9 s</strong></li>
          </ul>
        </article>

        <article className="signal-tile signal-tile--trend">
          <header>
            <span>Risk trend</span>
            <em>12 weeks · 4 series</em>
          </header>
          <LineChart
            labels={weeks}
            series={[
              { label: "Quality", values: trend.quality, tone: "good" },
              { label: "Capacity", values: trend.capacity, tone: "watch" },
              { label: "Correctness", values: trend.correctness, tone: "info" },
              { label: "Risk", values: trend.risk, tone: "risk" },
            ]}
            large
          />
          <footer className="chart-legend">
            <span><i className="dot dot--good" /> Quality</span>
            <span><i className="dot dot--watch" /> Capacity</span>
            <span><i className="dot dot--info" /> Correctness</span>
            <span><i className="dot dot--risk" /> Risk</span>
          </footer>
        </article>
      </div>
    </section>
  );
}

function SignalRail() {
  return (
    <aside className="signal-rail">
      <a className="signal-rail-brand" href="/viewer/" aria-label="Home">
        <span aria-hidden="true">PM</span>
      </a>
      <ul>
        {sections.map((s) => (
          <li key={s.id} className={s.id === "overview" ? "is-active" : ""}>
            <span className="signal-rail-mark" aria-hidden="true">{s.label.slice(0, 1)}</span>
            <span className="signal-rail-label">{s.label}</span>
            <i className={`signal-rail-tag signal-rail-tag--${s.tone}`}>{s.count}</i>
          </li>
        ))}
      </ul>
      <footer>
        <p>build</p>
        <strong>487</strong>
      </footer>
    </aside>
  );
}

/* ===== Chart primitives ===== */

function Sparkline({ values, tone }: { values: number[]; tone: Tone }) {
  const { line, area } = useMemo(() => {
    if (values.length < 2) return { line: "", area: "" };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 26 - ((v - min) / range) * 22 - 2;
      return [x, y] as const;
    });
    const linePath = points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
    const areaPath = `${linePath} L100,28 L0,28 Z`;
    return { line: linePath, area: areaPath };
  }, [values]);
  return (
    <svg
      className={`sparkline sparkline--${tone}`}
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="sparkline-area" d={area} />
      <path className="sparkline-line" d={line} />
    </svg>
  );
}

function LineChart({
  labels,
  series,
  large,
}: {
  labels: string[];
  series: Series[];
  large?: boolean;
}) {
  const width = 1000;
  const height = large ? 280 : 220;
  const pad = { top: 18, right: 24, bottom: 32, left: 44 };
  const allValues = series.flatMap((s) => s.values);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const padded = Math.max(2, (dataMax - dataMin) * 0.08);
  const min = Math.floor((dataMin - padded) / 10) * 10;
  const max = Math.ceil((dataMax + padded) / 10) * 10;
  const range = max - min || 1;

  const x = (i: number) =>
    pad.left + (i / (labels.length - 1)) * (width - pad.left - pad.right);
  const y = (v: number) =>
    pad.top + (1 - (v - min) / range) * (height - pad.top - pad.bottom);

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round(min + ((max - min) / tickCount) * i),
  );

  return (
    <svg className="chart-line" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={pad.left}
            y1={y(t)}
            x2={width - pad.right}
            y2={y(t)}
            className="chart-grid"
          />
          <text
            x={pad.left - 10}
            y={y(t) + 4}
            textAnchor="end"
            className="chart-tick"
          >
            {t}
          </text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text
          key={l}
          x={x(i)}
          y={height - 10}
          textAnchor="middle"
          className="chart-tick"
        >
          {l}
        </text>
      ))}
      {series.map((s) => {
        const path = s.values
          .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`)
          .join(" ");
        return (
          <path
            key={s.label}
            d={path}
            className={`chart-line-path chart-line-path--${s.tone}`}
          />
        );
      })}
      {series.map((s) =>
        s.values.map((v, i) => (
          <circle
            key={`${s.label}-${i}`}
            cx={x(i)}
            cy={y(v)}
            r="2.4"
            className={`chart-dot chart-dot--${s.tone}`}
          />
        )),
      )}
    </svg>
  );
}

function AreaChart({
  labels,
  series,
  compact,
}: {
  labels: string[];
  series: Series[];
  compact?: boolean;
}) {
  const width = 1000;
  const height = compact ? 140 : 280;
  const pad = compact
    ? { top: 6, right: 6, bottom: 8, left: 6 }
    : { top: 18, right: 24, bottom: 32, left: 44 };
  const allValues = series.flatMap((s) => s.values);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const padded = Math.max(2, (dataMax - dataMin) * 0.10);
  const min = Math.floor((dataMin - padded) / 10) * 10;
  const max = Math.ceil((dataMax + padded) / 10) * 10;
  const range = max - min || 1;

  const x = (i: number) =>
    pad.left + (i / (labels.length - 1)) * (width - pad.left - pad.right);
  const y = (v: number) =>
    pad.top + (1 - (v - min) / range) * (height - pad.top - pad.bottom);
  const yBase = height - pad.bottom;

  const tickCount = 4;
  const yTicks = compact
    ? []
    : Array.from({ length: tickCount + 1 }, (_, i) =>
        Math.round(min + ((max - min) / tickCount) * i),
      );

  const gradSuffix = compact ? "-c" : "";

  return (
    <svg
      className={`chart-area${compact ? " chart-area--compact" : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        {series.map((s) => (
          <linearGradient
            key={s.label}
            id={`grad-${s.tone}${gradSuffix}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" className={`chart-grad-from chart-grad-from--${s.tone}`} />
            <stop offset="100%" className="chart-grad-to" />
          </linearGradient>
        ))}
      </defs>
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={pad.left}
            y1={y(t)}
            x2={width - pad.right}
            y2={y(t)}
            className="chart-grid"
          />
          <text
            x={pad.left - 10}
            y={y(t) + 4}
            textAnchor="end"
            className="chart-tick"
          >
            {t}
          </text>
        </g>
      ))}
      {!compact &&
        labels.map((l, i) => (
          <text
            key={l}
            x={x(i)}
            y={height - 10}
            textAnchor="middle"
            className="chart-tick"
          >
            {l}
          </text>
        ))}
      {series.map((s) => {
        const linePath = s.values
          .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`)
          .join(" ");
        const areaPath = `${linePath} L${x(s.values.length - 1).toFixed(2)},${yBase} L${x(0).toFixed(2)},${yBase} Z`;
        return (
          <g key={s.label}>
            <path d={areaPath} fill={`url(#grad-${s.tone}${gradSuffix})`} />
            <path d={linePath} className={`chart-line-path chart-line-path--${s.tone}`} />
          </g>
        );
      })}
    </svg>
  );
}

function Donut({
  items,
  centerNum,
  centerLabel,
}: {
  items: { label: string; value: number; tone: Tone }[];
  centerNum: number;
  centerLabel: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg className="chart-donut" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={r} className="chart-donut-track" />
      {items.map((item) => {
        const length = (item.value / total) * c;
        const segment = (
          <circle
            key={item.label}
            cx="50"
            cy="50"
            r={r}
            className={`chart-donut-seg chart-donut-seg--${item.tone}`}
            strokeDasharray={`${length} ${c - length}`}
            strokeDashoffset={-offset}
          />
        );
        offset += length;
        return segment;
      })}
      <text x="50" y="52" textAnchor="middle" className="chart-donut-num">
        {centerNum}
      </text>
      <text x="50" y="64" textAnchor="middle" className="chart-donut-label">
        {centerLabel}
      </text>
    </svg>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element was not found.");
}
createRoot(root).render(<App />);
