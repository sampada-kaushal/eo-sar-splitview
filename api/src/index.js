import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.resolve("./data/uploads");
const PREVIEW_DIR = path.resolve("./data/previews");
const OUTPUT_DIR = path.resolve("./data/outputs");
const JOBS_FILE = path.resolve("./data/jobs.json");

fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(PREVIEW_DIR);
fs.ensureDirSync(OUTPUT_DIR);
if (!fs.existsSync(JOBS_FILE)) fs.writeJsonSync(JOBS_FILE, []);

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const imageId = uuidv4() + path.extname(file.originalname);
    cb(null, imageId);
  },
});
const upload = multer({ storage });

// -------- API Endpoints --------

// Upload with preview generation
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const uploadedPath = path.join(UPLOAD_DIR, req.file.filename);
  const previewName = req.file.filename.replace(/\.[^.]+$/, "") + "_preview.png";
  const previewPath = path.join(PREVIEW_DIR, previewName);

  console.log(`Generating preview for ${req.file.originalname} → ${previewName}`);

  // Downsample with gdal_translate
  const gdal = spawn("gdal_translate", [
    "-of",
    "PNG",
    "-outsize",
    "10%",
    "10%",
    uploadedPath,
    previewPath,
  ]);

  gdal.stderr.on("data", (d) => console.error("gdal stderr:", d.toString()));

  gdal.on("exit", (code) => {
    if (code !== 0) {
      console.error("gdal_translate failed:", code);
      return res.json({
        imageId: req.file.filename,
        filename: req.file.originalname,
        size: req.file.size,
        preview: null,
      });
    }

    console.log("Preview generated:", previewPath);
    res.json({
      imageId: req.file.filename,
      filename: req.file.originalname,
      size: req.file.size,
      preview: { url: `/previews/${previewName}` },
    });
  });
});
// Create Job
app.post("/api/jobs", async (req, res) => {
  const { imageAId, imageBId, aoi } = req.body;
  if (!imageAId || !imageBId || !aoi) {
    return res.status(400).json({ error: "Missing inputs" });
  }

  const jobId = uuidv4();
  const jobDir = path.join(OUTPUT_DIR, jobId);
  fs.ensureDirSync(jobDir);

  let jobs = [];
  try {
    jobs = await fs.readJson(JOBS_FILE);
  } catch { }
  const newJob = {
    jobId,
    status: "Running",
    imageAId,
    imageBId,
    aoi,
    outputs: null,
    error: null,
  };
  jobs.push(newJob);
  await fs.writeJson(JOBS_FILE, jobs);

  //Pass AOI as JSON string so worker.py can parse it
  const aoiStr = `north=${aoi.north};south=${aoi.south};east=${aoi.east};west=${aoi.west}`;

  const worker = spawn("python3", [
    path.resolve("./worker/worker.py"),
    "--image_a",
    path.join(UPLOAD_DIR, imageAId),
    "--image_b",
    path.join(UPLOAD_DIR, imageBId),
    "--aoi",
    aoiStr,
    "--out_dir",
    jobDir,
  ]);
  console.log("Spawning worker:", [
    path.resolve("./worker/worker.py"),
    "--image_a",
    path.join(UPLOAD_DIR, imageAId),
    "--image_b",
    path.join(UPLOAD_DIR, imageBId),
    "--aoi",
    aoiStr,
    "--out_dir",
    jobDir,
  ].join(" "));
  let workerError = "";
  worker.stdout.on("data", (data) => {
    console.log("Worker:", data.toString());
  });
  worker.stderr.on("data", (data) => {
    console.error("Worker error:", data.toString());
    workerError += data.toString();
  });

  worker.on("exit", async (code) => {
    let jobs = await fs.readJson(JOBS_FILE);
    const job = jobs.find((j) => j.jobId === jobId);
    if (!job) return;

    if (code === 0) {
      job.status = "Done";
      job.outputs = {
        imageAUrl: `/data/outputs/${jobId}/A_clipped.tif`,
        imageBUrl: `/data/outputs/${jobId}/B_clipped_aligned.tif`,
      };
    } else {
      job.status = "Error";
      job.error = workerError || `Worker exited code ${code}`;
    }
    await fs.writeJson(JOBS_FILE, jobs);
  });

  res.json({ jobId });
});

// Get job status
app.get("/api/jobs/:jobId", async (req, res) => {
  let jobs = [];
  try {
    jobs = await fs.readJson(JOBS_FILE);
  } catch { }
  const job = jobs.find((j) => j.jobId === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// Serve static files
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/data/outputs", express.static(OUTPUT_DIR));
app.use("/previews", express.static(PREVIEW_DIR));

app.listen(PORT, () => console.log(`API running on :${PORT}`));
