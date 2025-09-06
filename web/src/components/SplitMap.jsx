import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function SplitMap({ leftSrc, rightSrc, aoi, onAoiChange }) {
    const leftMapRef = useRef(null);
    const rightMapRef = useRef(null);
    const rectRef = useRef(null);

    const [leftReady, setLeftReady] = useState(false);

    // Add image overlay and call callback when loaded
    const addOverlay = (mapRef, src, onLoad) => {
        const map = mapRef.current;
        if (!map || !src?.url) return;

        const url = src.url.startsWith("http") ? src.url : `${API_BASE}${src.url}`;

        const img = new Image();
        img.onload = () => {
            const bounds = [[0, 0], [img.height, img.width]];
            L.imageOverlay(url, bounds).addTo(map);
            overlay.once("load", () => setLeftReady(true));
            map.fitBounds(bounds);
            onLoad();
        };
        img.src = url;
    };

    useEffect(() => {
        // Initialize left map
        const leftMap = L.map("left-map", { crs: L.CRS.Simple }).setView([0, 0], 0);
        leftMapRef.current = leftMap;
        addOverlay(leftMapRef, leftSrc, () => setLeftReady(true));

        // Initialize right map
        const rightMap = L.map("right-map", { crs: L.CRS.Simple }).setView([0, 0], 0);
        rightMapRef.current = rightMap;
        addOverlay(rightMapRef, rightSrc, () => { });

        // Sync maps
        let blocked = false;
        const sync = (src, tgt) => {
            if (blocked) return;
            blocked = true;
            tgt.setView(src.getCenter(), src.getZoom(), { animate: false });
            blocked = false;
        };
        leftMap.on("move", () => sync(leftMap, rightMap));
        rightMap.on("move", () => sync(rightMap, leftMap));

        return () => {
            leftMap.remove();
            rightMap.remove();
        };
    }, [leftSrc, rightSrc]);

    // Enable AOI drawing only when left map is ready
    useEffect(() => {
        const map = leftMapRef.current;
        if (!map || !leftReady) return;

        map.on("click", (e) => {
            if (rectRef.current) map.removeLayer(rectRef.current);

            // Draw AOI rectangle (example size)
            const size = 50;
            const bounds = [
                [e.latlng.lat - size, e.latlng.lng - size],
                [e.latlng.lat + size, e.latlng.lng + size],
            ];
            rectRef.current = L.rectangle(bounds, { color: "red", weight: 2 }).addTo(map);

            onAoiChange({
                north: bounds[1][0],
                south: bounds[0][0],
                east: bounds[1][1],
                west: bounds[0][1],
            });
        });
    }, [leftReady, onAoiChange]);

    // Redraw AOI if programmatically updated
    useEffect(() => {
        const map = leftMapRef.current;
        if (!map || !aoi) return;

        if (rectRef.current) map.removeLayer(rectRef.current);
        const bounds = [
            [aoi.south, aoi.west],
            [aoi.north, aoi.east],
        ];
        rectRef.current = L.rectangle(bounds, { color: "red", weight: 2 }).addTo(map);
    }, [aoi]);

    return (
        <div style={{ display: "flex", gap: 8, height: "500px" }}>
            <div id="left-map" style={{ flex: 1, height: "100%" }} />
            <div id="right-map" style={{ flex: 1, height: "100%" }} />
        </div>
    );
}
