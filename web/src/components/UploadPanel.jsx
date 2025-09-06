import React, { useState } from "react";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function UploadPanel({ onUploaded, disabled }) {
    const [fileA, setFileA] = useState(null);
    const [fileB, setFileB] = useState(null);
    const [busy, setBusy] = useState(false);

    async function uploadOne(file) {
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch(`${API}/api/upload`, { method: "POST", body: fd });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Upload failed (${res.status}): ${text}`);
        }
        const json = await res.json();

        if (json.preview && json.preview.url) {
            json.preview.url = `${API}${json.preview.url}`;
        }

        return json; // json of { imageId, preview }
    }

    async function handleUpload() {
        if (!fileA || !fileB) return alert("Pick both Image A and Image B");
        setBusy(true);
        try {
            const [A, B] = await Promise.all([uploadOne(fileA), uploadOne(fileB)]);
            // Call parent with structured info
            onUploaded({
                a: A.imageId,
                aPreview: A.preview,
                b: B.imageId,
                bPreview: B.preview,
            });
        } catch (err) {
            console.error("Upload error:", err);
            alert(err.message || "Upload failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div>
                <div>
                    <label style={{ display: "block", marginBottom: 6 }}>
                        Image A{" "}
                        <input
                            type="file"
                            accept=".tif,.tiff"
                            onChange={(e) => setFileA(e.target.files?.[0] || null)}
                            disabled={disabled || busy}
                        />
                    </label>
                </div>

                <div>
                    <label style={{ display: "block", marginBottom: 6 }}>
                        Image B{" "}
                        <input
                            type="file"
                            accept=".tif,.tiff"
                            onChange={(e) => setFileB(e.target.files?.[0] || null)}
                            disabled={disabled || busy}
                        />
                    </label>
                </div>

                <div style={{ marginTop: 8 }}>
                    <button onClick={handleUpload} disabled={busy || disabled}>
                        {busy ? "Uploading…" : "Upload"}
                    </button>
                </div>

                <div style={{ marginTop: 8, fontSize: 13 }}>
                    {fileA && <div>A: {fileA.name} ({(fileA.size / 1e6).toFixed(1)} MB)</div>}
                    {fileB && <div>B: {fileB.name} ({(fileB.size / 1e6).toFixed(1)} MB)</div>}
                </div>
            </div>
        </div>
    );
}
