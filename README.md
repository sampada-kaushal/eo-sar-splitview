# EO–SAR Splitview

A prototype pipeline for aligning Earth Observation (EO) and Synthetic Aperture Radar (SAR) raster imagery over a user-defined AOI (area of interest).

---

## Setup

Clone the repository and run with Docker:

```bash
git clone https://github.com/sampada-kaushal/eo-sar-splitview.git
cd eo-sar-splitview
docker compose up --build
```

This will spin up three services:
* web – React frontend (served at http://localhost:5173)

* api – Node.js backend REST API (http://localhost:8080)

* worker – Python processor (invoked by API jobs)

## API Endpoints

1. Upload image

POST /api/upload

Multipart form-data with file.
Response:
```bash
{
  "id": "abcd123",
  "previewUrl": "/previews/abcd123_preview.png"
}
```

2. Create a processing job

POST /api/jobs

JSON body:
```bash
{
  "imageAId": "abcd123",
  "imageBId": "efgh456",
  "aoi": { "north": 73.2752, "south": -26.7248, "east": 131.5, "west": 31.5 }
}
```
Response:
```bash
{
  "jobId": "job-xyz789"
}

```

3. Get job status

GET /api/jobs/:id

Response (when done):
```bash
{
  "id": "job-xyz789",
  "status": "DONE",
  "outputs": 
  {
    "imageAUrl": "/rasters/outputs/job-xyz789/A_clipped.tif",
    "imageBUrl": "/rasters/outputs/job-xyz789/B_clipped_aligned.tif"
  }
}

```
## Alignment Method (Why & How)
For this prototype, chose a translation-only image alignment approach.

The worker script:

* Clips both rasters to the AOI using Rasterio.

* Estimates the pixel shift between them with phase cross-correlation (from scikit-image).

* Applies the sub-pixel shift to the moving image and reprojects it into the reference image’s grid.

Why this method?
It is fast, lightweight, and works well when two images differ only by translation (common in EO/SAR pairs where geometry is already roughly aligned). It avoids heavier methods like feature-matching or full orthorectification, keeping the demo simple and responsive.

## Known Limitations & Tradeoffs

* Assumes images are already roughly coregistered and only require translation.

* No rotation, scale, or terrain correction.

* CRS handling is simplified: AOI is given in EPSG:4326, then transformed into each raster’s CRS for clipping.

* Not robust to large geometric distortions or very different acquisition angles.

## Demo Flow

(In the UI at http://localhost:5173
)

* Upload two GeoTIFFs (EO + SAR).

* Draw AOI rectangle on the map.

* Click Process AOI – backend spawns a job.

* When finished, toggle Show processed to see the aligned overlays side-by-side.

## Sample Data

You can test with two small GeoTIFFs (examples included in /data or via external links):

* Example EO image (CRS: EPSG:4326)

* Example SAR image (CRS: EPSG:4326)

(Replace with other sample files if needed. Large files may not display well in the browser.)

## Next Steps

* Feature-based alignment: Match keypoints (e.g. corners/patterns) for more robust results.

* CRS reprojection: Reproject images into a common map projection.

* Job queue: Use a queue (e.g. RabbitMQ/ SQS) to manage multiple jobs at scale.
