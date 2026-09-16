import data from "./data/results.json";

export type ResultRow = {
  id: string;
  model: string;
  shortName: string;
  family: "closed" | "open";
  reasoning: "Max" | "High";
  passAt1: number;
  pass3: number;
  light: number;
  standard: number;
  hard: number;
  steps: number;
  cost: number;
  outcomeCompletion: number;
  outcomeRuns: number;
  anySeed: number;
  anySeedWorlds: number;
  seeds: number[];
  consistency: number[];
};

export const WORLDS = data.worlds;
export const SEEDS = data.seeds;
export const DIFFICULTY = data.difficulty;
export const RESULTS = data.models as ResultRow[];
export const RANKED_RESULTS = [...RESULTS].sort((a, b) => b.passAt1 - a.passAt1);
export const percent = (value: number) => `${value.toFixed(1)}%`;
export const dollars = (value: number) => `$${value.toFixed(2)}`;

const columns: Array<[string, keyof ResultRow]> = [
  ["Model", "model"], ["Model group", "family"], ["Reasoning", "reasoning"],
  ["Pass@1 (%)", "passAt1"], ["Pass^3 (%)", "pass3"],
  ["Light (%)", "light"], ["Standard (%)", "standard"], ["Hard (%)", "hard"],
  ["Steps per case", "steps"], ["USD per case", "cost"],
  ["Outcome completion (%)", "outcomeCompletion"], ["Any seed (%)", "anySeed"],
];
const quote = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
export const RESULTS_CSV = [
  columns.map(([label]) => quote(label)).join(","),
  ...RESULTS.map((row) => columns.map(([, key]) => quote(row[key])).join(",")),
].join("\r\n");
