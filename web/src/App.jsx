import React, { useEffect, useState } from "react";
import UploadPanel from "./components/UploadPanel.jsx";
import SplitMap from "./components/SplitMap.jsx";
import Progress from "./components/Progress.jsx";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function App() {
    const [images, setImages] = useState({
        a: null,
        aPreview: null,
        b: null,
        bPreview: null,
    });

    const [aoi, setAoi] = useState(null);
    const [resetAoiSignal, setResetAoiSignal] = useState(0);

    const [mapsReady, setMapsReady] = useState(false);

    const [job, setJob] = useState(null);
    const [showProcessed, setShowProcessed] = useState(false);
    const [polling, setPolling] = useState(false);

    // Called when SplitMap tells us overlays are ready
    function handleLayersReady(flag) {
        setMapsReady(Boolean(flag));
    }

    // Start backend job
    async function startJob() {
        if (!images.a || !images.b) return alert("Upload both images first");
        if (!aoi) return alert("Draw an AOI");

        try {
            const res = await fetch(`${API}/api/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageAId: images.a, imageBId: images.b, aoi }),
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(`Failed to start job (${res.status}) ${txt}`);
            }

            const j = await res.json();
            setJob({ id: j.jobId, status: "PENDING" });
            setShowProcessed(false);
            // start polling handled by effect below
        } catch (err) {
            console.error("Start job error:", err);
            alert(err.message || "Failed to start job");
        }
    }

    // Polling effect
    useEffect(() => {
        if (!job?.id) return;
        if (polling) return; // prevent duplicate
        setPolling(true);

        const t = setInterval(async () => {
            try {
                const res = await fetch(`${API}/api/jobs/${job.id}`);
                if (!res.ok) return;
                const j = await res.json();
                setJob(j);

                // if job done, stop polling
                if (j.status === "DONE" || j.status === "ERROR") {
                    clearInterval(t);
                    setPolling(false);
                    if (j.status === "ERROR") {
                        alert(`Job failed: ${j.error || "unknown error"}`);
                    }
                }
            } catch (err) {
                console.error("Poll error:", err);
            }
        }, 2000);

        return () => {
            clearInterval(t);
            setPolling(false);
        };
    }, [job?.id]);

    // left/right sources switch when showProcessed is checked and job done
    const leftSrc = showProcessed && job?.status === "DONE" && job.outputs?.imageAUrl
        ? { url: `${API}${job.outputs.imageAUrl}`, bounds: job.outputs.imageABounds }
        : images.aPreview;

    const rightSrc = showProcessed && job?.status === "DONE" && job.outputs?.imageBUrl
        ? { url: `${API}${job.outputs.imageBUrl}`, bounds: job.outputs.imageBBounds }
        : images.bPreview;



    // Determine whether Process button should be enabled
    const processDisabled =
        !images.a ||
        !images.b ||
        !aoi ||
        !mapsReady ||
        (job && job.status !== "ERROR" && job.status !== "DONE");

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <UploadPanel
                    onUploaded={(u) =>
                        setImages((prev) => ({
                            ...prev,
                            a: u.a ?? prev.a,
                            aPreview: u.aPreview ?? prev.aPreview,
                            b: u.b ?? prev.b,
                            bPreview: u.bPreview ?? prev.bPreview,
                        }))
                    }
                    disabled={job && job.status === "RUNNING"}
                />

                <button onClick={startJob} disabled={processDisabled}>
                    Process AOI
                </button>

                <button
                    onClick={() => {
                        setAoi(null);
                        setResetAoiSignal((s) => s + 1);
                    }}
                >
                    Reset AOI
                </button>

                <div>
                    AOI:{" "}
                    {aoi
                        ? `${aoi.south.toFixed(4)}, ${aoi.west.toFixed(4)} — ${aoi.north.toFixed(
                            4
                        )}, ${aoi.east.toFixed(4)}`
                        : "—"}
                </div>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                    {job && <Progress status={job.status} />}
                    {job?.status === "DONE" && (
                        <label>
                            <input
                                type="checkbox"
                                checked={showProcessed}
                                onChange={(e) => setShowProcessed(e.target.checked)}
                            />{" "}
                            Show processed
                        </label>
                    )}
                </div>
            </div>

            <div style={{ height: "600px" }}>
                <SplitMap
                    leftSrc={leftSrc}
                    rightSrc={rightSrc}
                    aoi={aoi}
                    onAoiChange={setAoi}
                    resetSignal={resetAoiSignal}
                    onLayersReady={handleLayersReady}
                />
            </div>
        </div>
    );
}
