import { spawn } from "node:child_process";
import { readJobs, writeJobs } from "./storage.js";

export function createJob({ imageAPath, imageBPath, aoi }) {
  const db = readJobs();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  db.jobs.push({ id, status: "PENDING", aoi, imageAPath, imageBPath });
  writeJobs(db);

  const outDir = `/data/outputs/${id}`;
  const args = [
    "/app/worker.py",
    "--image_a", imageAPath,
    "--image_b", imageBPath,
    "--aoi", `north=${aoi.north};south=${aoi.south};east=${aoi.east};west=${aoi.west}`,
    "--out_dir", outDir
  ];

  // Worker is available inside the API container via bind mount at /app/worker.py
  const proc = spawn("python", args, { stdio: ["ignore", "pipe", "pipe"] });

  updateJob(id, { status: "RUNNING" });

  proc.stdout.on("data", d => console.log(`[job ${id}]`, d.toString()));
  proc.stderr.on("data", d => console.error(`[job ${id} ERR]`, d.toString()));
  proc.on("exit", (code) => {
    if (code === 0) {
      updateJob(id, {
        status: "DONE",
        outputs: {
          imageAUrl: `/rasters/outputs/${id}/A_clipped.tif`,
          imageBUrl: `/rasters/outputs/${id}/B_clipped_aligned.tif`
        }
      });
    } else {
      updateJob(id, { status: "ERROR", error: `Worker exited ${code}` });
    }
  });

  return id;
}

export function getJob(id) {
  const db = readJobs();
  return db.jobs.find(j => j.id === id);
}

export function updateJob(id, patch) {
  const db = readJobs();
  const j = db.jobs.find(x => x.id === id);
  if (!j) return;
  Object.assign(j, patch);
  writeJobs(db);
}
