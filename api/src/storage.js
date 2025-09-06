import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DATA = "/data";
export const UPLOADS = join(DATA, "uploads");
export const PREVIEWS = join(DATA, "previews");
export const OUTPUTS = join(DATA, "outputs");
export const JOBS_JSON = join(DATA, "jobs.json");

export function ensureDirs() {
  for (const d of [DATA, UPLOADS, PREVIEWS, OUTPUTS]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
  if (!existsSync(JOBS_JSON)) writeFileSync(JOBS_JSON, JSON.stringify({ jobs: [] }, null, 2));
}

export function readJobs() {
  return JSON.parse(readFileSync(JOBS_JSON, "utf8"));
}
export function writeJobs(db) {
  writeFileSync(JOBS_JSON, JSON.stringify(db, null, 2));
}
