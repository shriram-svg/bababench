import worldJson from "./world.json";
import worldsJson from "./worlds.json";
import type { World, WorldSummary } from "./types";

export const world = worldJson as unknown as World;
export const worlds = worldsJson as unknown as WorldSummary[];
