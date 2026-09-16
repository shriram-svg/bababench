import { dollars, percent } from "./results";
import type { ResultRow } from "./results";

export type PerformanceKey = "passAt1" | "pass3";
export type EfficiencyKey = "cost" | "steps";
export type MetricKey = PerformanceKey | EfficiencyKey;
export type Metric = {
  key: MetricKey;
  label: string;
  maximum: number;
  step: number;
  format: (value: number) => string;
};

export const METRICS: Record<MetricKey, Metric> = {
  passAt1: { key: "passAt1", label: "Pass@1", maximum: 60, step: 10, format: percent },
  pass3: { key: "pass3", label: "Pass³", maximum: 50, step: 10, format: percent },
  cost: { key: "cost", label: "Cost per case", maximum: 6, step: 1, format: dollars },
  steps: { key: "steps", label: "Steps per case", maximum: 150, step: 30, format: (v) => v.toFixed(1) },
};

// A model is on the frontier if no model matches or improves both measures.
export function paretoFront(rows: ResultRow[], x: EfficiencyKey, y: PerformanceKey): ResultRow[] {
  return rows.filter((row) => !rows.some((other) =>
    other[x] <= row[x] && other[y] >= row[y] && (other[x] < row[x] || other[y] > row[y]),
  )).sort((a, b) => a[x] - b[x]);
}
