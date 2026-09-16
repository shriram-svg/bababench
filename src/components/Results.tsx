import { useState } from "react";
import type { CSSProperties } from "react";
import { DIFFICULTY, RANKED_RESULTS, RESULTS, RESULTS_CSV, SEEDS, WORLDS, dollars, percent } from "../content/results";
import type { ResultRow } from "../content/results";
import { METRICS, paretoFront } from "../content/measures";
import type { EfficiencyKey, PerformanceKey } from "../content/measures";

const csvUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(RESULTS_CSV)}`;
const groups = [
  { value: "all", label: "All models", count: RESULTS.length },
  { value: "closed", label: "Closed-source", count: RESULTS.filter((r) => r.family === "closed").length },
  { value: "open", label: "Open-weight", count: RESULTS.filter((r) => r.family === "open").length },
] as const;
type SortKey = "passAt1" | "pass3" | "light" | "standard" | "hard" | "steps" | "cost";
const tableMetrics: Array<{ key: SortKey; label: string; count?: number }> = [
  { key: "passAt1", label: "Pass@1" }, { key: "pass3", label: "Pass³" },
  { key: "light", label: "Light", count: DIFFICULTY.light },
  { key: "standard", label: "Standard", count: DIFFICULTY.standard },
  { key: "hard", label: "Hard", count: DIFFICULTY.hard },
  { key: "steps", label: "Steps / case" }, { key: "cost", label: "$ / case" },
];

export function Leaderboard() {
  const [group, setGroup] = useState<(typeof groups)[number]["value"]>("all");
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: "passAt1", ascending: false });
  const rows = RESULTS.filter((row) => group === "all" || row.family === group)
    .sort((a, b) => (sort.ascending ? 1 : -1) * (a[sort.key] - b[sort.key]));
  const setSortKey = (key: SortKey) => setSort({
    key, ascending: sort.key === key ? !sort.ascending : key === "cost" || key === "steps",
  });
  return (
    <figure className="paperResults resultsWide" aria-label="Benchmark results">
      <div className="resultsToolbar">
        <div className="resultsFilters" role="group" aria-label="Model group">
          {groups.map((item) => (
            <button type="button" key={item.value} aria-pressed={group === item.value} onClick={() => setGroup(item.value)}>
              {item.label}<span>{item.count}</span>
            </button>
          ))}
        </div>
        <a className="resultsDownload" href={csvUrl} download="bababench-results.csv">Download data ↓</a>
      </div>
      <div className="resultsTableScroll" role="region" tabIndex={0} aria-label="Results table. Scroll horizontally to see all columns.">
        <table className="resultsTable">
          <thead>
            <tr className="resultsColumnGroups">
              <th colSpan={2} scope="colgroup">{WORLDS} simulated cases · {SEEDS} seeds</th>
              <th colSpan={2} scope="colgroup">Overall accuracy ↑</th>
              <th colSpan={3} scope="colgroup">Accuracy by difficulty ↑</th>
              <th colSpan={2} scope="colgroup">Efficiency ↓</th>
            </tr>
            <tr>
              <th scope="col" className="resultsModelHeading">Model</th>
              <th scope="col">Reasoning</th>
              {tableMetrics.map(({ key, label, count }) => (
                <th key={key} scope="col" className="resultsNumeric" aria-sort={sort.key === key ? (sort.ascending ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => setSortKey(key)} aria-label={`Sort by ${label}`}>
                    {label}<span className="sortDirection" aria-hidden="true">{sort.key === key ? (sort.ascending ? "↑" : "↓") : "↕"}</span>
                    {count !== undefined && <small>{count} cases</small>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-model={row.id}>
                <th scope="row" className="resultsModel">
                  <span className={`modelShape ${row.family}`} aria-label={row.family === "open" ? "Open-weight model" : "Closed-source model"} />
                  {row.model}
                </th>
                <td className="resultsReasoning">{row.reasoning}</td>
                {tableMetrics.map(({ key }) => {
                  const accuracy = key !== "steps" && key !== "cost";
                  return (
                    <td key={key} className={`resultsNumeric ${accuracy ? "resultsAccuracy" : "resultsEfficiency"} ${key === "passAt1" ? "resultsPrimary" : ""}`}>
                      <span style={accuracy ? { "--heat": `${4 + row[key] * 0.15}%` } as CSSProperties : undefined}>
                        {key === "cost" ? dollars(row[key]) : accuracy ? percent(row[key]) : row[key].toFixed(1)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="resultsScrollHint">Scroll to compare all measures →</p>
      <figcaption>
        Pass@1 averages the pass rate across three seeds. Pass³ is the share of simulated cases passed in all three seeds.
        Costs are the paper’s per-case estimates. Source: Table 2.
      </figcaption>
    </figure>
  );
}

type PlotPoint = { row: ResultRow; x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function placeLabels(points: PlotPoint[], width: number, height: number, compact: boolean) {
  const placed: Box[] = [];
  return new Map(points.map((point) => {
    const w = point.row.shortName.length * (compact ? 7.5 : 7) + 10;
    const h = 19;
    const candidates = [
      [12, -h / 2], [12, -h - 8], [-w / 2, -h - 10], [-w - 12, -h / 2],
      [12, 12], [-w / 2, 14], [-w - 12, -h - 8], [-w - 12, 12],
      [12, -h - 30], [12, 32], [-w - 12, -h - 30], [-w - 12, 32],
    ].map(([dx, dy]) => ({ x: Math.max(60, Math.min(width - w - 15, point.x + dx)), y: Math.max(14, Math.min(height - 72, point.y + dy)), w, h }));
    const score = (box: Box) => placed.filter((other) => overlap(box, other)).length * 1000
      + points.filter((other) => overlap(box, { x: other.x - 9, y: other.y - 9, w: 18, h: 18 })).length * 100
      + Math.hypot(box.x + w / 2 - point.x, box.y + h / 2 - point.y);
    const box = candidates.reduce((best, current) => score(current) < score(best) ? current : best);
    placed.push(box);
    return [point.row.id, box] as const;
  }));
}

function ScatterPlot({ xKey, yKey, selected, onSelect, compact = false }: {
  xKey: EfficiencyKey; yKey: PerformanceKey; selected: string; onSelect: (id: string) => void; compact?: boolean;
}) {
  const width = compact ? 420 : 1000;
  const height = compact ? 370 : 460;
  const pad = { left: compact ? 54 : 65, right: compact ? 24 : 42, top: 35, bottom: 60 };
  const xMetric = METRICS[xKey];
  const yMetric = METRICS[yKey];
  const x = (v: number) => pad.left + (v / xMetric.maximum) * (width - pad.left - pad.right);
  const y = (v: number) => height - pad.bottom - (v / yMetric.maximum) * (height - pad.top - pad.bottom);
  const frontier = paretoFront(RESULTS, xKey, yKey);
  const frontierIds = new Set(frontier.map((row) => row.id));
  const points = RANKED_RESULTS.map((row) => ({ row, x: x(row[xKey]), y: y(row[yKey]) }));
  const labeled = compact ? points.filter((p) => frontierIds.has(p.row.id) || selected === p.row.id) : points;
  const labels = placeLabels(labeled, width, height, compact);
  const xTicks = Array.from({ length: xMetric.maximum / xMetric.step + 1 }, (_, i) => i * xMetric.step);
  const yTicks = Array.from({ length: yMetric.maximum / yMetric.step + 1 }, (_, i) => i * yMetric.step);
  return (
    <svg className={`resultsScatter ${compact ? "scatterCompact" : "scatterFull"}`} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${yMetric.label} versus ${xMetric.label}. Select a model point for its values.`}>
      {yTicks.map((value) => (
        <g key={value}>
          <line className="scatterGrid" x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} />
          <text className="scatterTick" x={pad.left - 12} y={y(value) + 4} textAnchor="end">{value}%</text>
        </g>
      ))}
      {xTicks.map((value) => (
        <g key={value}>
          <line className="scatterTickMark" x1={x(value)} x2={x(value)} y1={height - pad.bottom} y2={height - pad.bottom + 5} />
          <text className="scatterTick" x={x(value)} y={height - pad.bottom + 24} textAnchor="middle">{xKey === "cost" ? `$${value}` : value}</text>
        </g>
      ))}
      <text className="scatterAxisName" x={pad.left} y={17}>{yMetric.label} (%) ↑</text>
      <text className="scatterAxisName" x={width - pad.right} y={height - 9} textAnchor="end">{xKey === "cost" ? "Cost per case (USD)" : "Steps per case"} →</text>
      <polyline className="scatterFrontier" points={frontier.map((row) => `${x(row[xKey])},${y(row[yKey])}`).join(" ")} />
      {points.map((point) => {
        const active = selected === point.row.id;
        const label = labels.get(point.row.id);
        return (
          <g key={point.row.id} className={`scatterPoint ${frontierIds.has(point.row.id) ? "onFrontier" : ""} ${active ? "isSelected" : ""}`}
            role="button" tabIndex={0} aria-pressed={active}
            aria-label={`${point.row.model}: ${yMetric.label} ${percent(point.row[yKey])}, ${xMetric.label} ${xMetric.format(point.row[xKey])}`}
            onClick={() => onSelect(point.row.id)} onFocus={() => onSelect(point.row.id)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(point.row.id); } }}>
            <title>{`${point.row.model}: ${yMetric.label} ${percent(point.row[yKey])}, ${xMetric.label} ${xMetric.format(point.row[xKey])}`}</title>
            <circle className="scatterHit" cx={point.x} cy={point.y} r={compact ? 17 : 14} />
            <circle className="scatterSelection" cx={point.x} cy={point.y} r={11} />
            {point.row.family === "open" ? <rect className="scatterDot" x={point.x - 5} y={point.y - 5} width={10} height={10} transform={`rotate(45 ${point.x} ${point.y})`} />
              : <circle className="scatterDot" cx={point.x} cy={point.y} r={6} />}
            {label && <text className="scatterLabel" x={label.x + 4} y={label.y + 14}>{point.row.shortName}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function TradeoffChart() {
  const [xKey, setXKey] = useState<EfficiencyKey>("cost");
  const [yKey, setYKey] = useState<PerformanceKey>("passAt1");
  const [selected, setSelected] = useState("grok-4-6");
  const row = RESULTS.find((item) => item.id === selected)!;
  const frontier = paretoFront(RESULTS, xKey, yKey);
  return (
    <figure className="resultsChart resultsWide" aria-label="Cost and performance chart">
      <div className="resultsChartHeader">
        <div>
          <h4>Cost and consistency</h4>
          <p>Pass rate by cost and interaction steps.</p>
        </div>
        <div className="resultsChartControls">
          <label>Accuracy<select aria-label="Chart accuracy" value={yKey} onChange={(event) => setYKey(event.target.value as PerformanceKey)}>
            <option value="passAt1">Pass@1</option><option value="pass3">Pass³ · all three seeds</option>
          </select></label>
          <label>Compare with<select aria-label="Chart efficiency" value={xKey} onChange={(event) => setXKey(event.target.value as EfficiencyKey)}>
            <option value="cost">Cost per case</option><option value="steps">Steps per case</option>
          </select></label>
        </div>
      </div>
      <div className="scatterLegend"><span><i className="frontierKey" />Pareto frontier</span><span><i className="modelShape closed" />Closed-source</span><span><i className="modelShape open" />Open-weight</span></div>
      <ScatterPlot xKey={xKey} yKey={yKey} selected={selected} onSelect={setSelected} />
      <ScatterPlot xKey={xKey} yKey={yKey} selected={selected} onSelect={setSelected} compact />
      <div className="resultsChartDetail" aria-live="polite">
        <label>Inspect a model<select aria-label="Inspect a model" value={selected} onChange={(event) => setSelected(event.target.value)}>
          {RANKED_RESULTS.map((item) => <option key={item.id} value={item.id}>{item.model}</option>)}
        </select></label>
        <div><span>{METRICS[yKey].label}</span><strong>{percent(row[yKey])}</strong></div>
        <div><span>{METRICS[xKey].label}</span><strong>{METRICS[xKey].format(row[xKey])}</strong></div>
        <span className="frontierStatus">{frontier.some((item) => item.id === selected) ? "On the frontier" : "Below the frontier"}</span>
      </div>
    </figure>
  );
}

export function OutcomeChart() {
  return (
    <figure className="outcomeFigure" aria-label="Outcome completion and pass rate by model">
      <div className="resultsChartHeader">
        <div><h4>Outcome completion vs. pass rate</h4></div>
      </div>
      <div className="outcomeLegend"><span><i className="outcomeStrictKey" />Pass rate</span><span><i className="outcomeCompleteKey" />Outcome completion</span></div>
      <div className="outcomePlot" role="list" aria-label="Pass rate and outcome completion by model">
        <div className="outcomeScale" aria-hidden="true"><span /><div><span>0%</span><span>50%</span><span>100%</span></div><span>Pass / outcome</span></div>
        {RANKED_RESULTS.map((row) => (
          <div className="outcomeRow" key={row.id} role="listitem">
            <span className="outcomeModel">{row.model}</span>
            <div className="outcomeTrack" aria-hidden="true">
              <span className="outcomeGap" style={{ left: `${row.passAt1}%`, width: `${row.outcomeCompletion - row.passAt1}%` }} />
              <span className="outcomeDot outcomeComplete" style={{ left: `${row.outcomeCompletion}%` }} />
              <span className="outcomeDot outcomeStrict" style={{ left: `${row.passAt1}%` }} />
            </div>
            <span className="outcomeValues" aria-label={`${percent(row.passAt1)} pass rate; ${percent(row.outcomeCompletion)} outcome completion`}><b>{percent(row.passAt1)}</b><span aria-hidden="true"> / </span><span>{percent(row.outcomeCompletion)}</span></span>
          </div>
        ))}
      </div>
      <figcaption>Outcome completion counts runs that reach every required outcome. Pass rate also checks authority, grounding, and prohibited actions. Sources: Tables 2 and 12.</figcaption>
    </figure>
  );
}
