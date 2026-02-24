"use client";

import { useEffect, useRef } from "react";
import type { MapBbox } from "@/types/run";
import { decodePolyline } from "@/lib/run/polyline";

interface RunMapProps {
  polyline: string | null;
  bbox: MapBbox | null;
  height?: string;
  className?: string;
  splitMarkers?: Array<{ lat: number; lng: number; label: string }>;
}

export function RunMap({
  polyline,
  bbox,
  height = "260px",
  className = "",
  splitMarkers,
}: RunMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !polyline) return;

    let mounted = true;

    async function initMap() {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (!mounted || !mapRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
      });

      mapInstanceRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);

      const points = decodePolyline(polyline!);
      if (points.length === 0) return;

      const latLngs = points.map((p) => L.latLng(p.lat, p.lng));

      L.polyline(latLngs, {
        color: "hsl(var(--primary))",
        weight: 3,
        opacity: 0.9,
      }).addTo(map);

      // Start marker
      L.circleMarker(latLngs[0], {
        radius: 6,
        fillColor: "#34d399",
        fillOpacity: 1,
        stroke: true,
        color: "#fff",
        weight: 2,
      }).addTo(map);

      // End marker
      L.circleMarker(latLngs[latLngs.length - 1], {
        radius: 6,
        fillColor: "#f87171",
        fillOpacity: 1,
        stroke: true,
        color: "#fff",
        weight: 2,
      }).addTo(map);

      // Split markers
      if (splitMarkers) {
        for (const marker of splitMarkers) {
          L.circleMarker(L.latLng(marker.lat, marker.lng), {
            radius: 4,
            fillColor: "#94a3b8",
            fillOpacity: 0.8,
            stroke: false,
          })
            .bindTooltip(marker.label, { permanent: false })
            .addTo(map);
        }
      }

      if (bbox) {
        map.fitBounds([
          [bbox.minLat, bbox.minLng],
          [bbox.maxLat, bbox.maxLng],
        ], { padding: [20, 20] });
      } else {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [20, 20] });
      }
    }

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [polyline, bbox, splitMarkers]);

  if (!polyline) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-muted/30 text-sm text-muted-foreground ${className}`}
        style={{ height }}
      >
        No route data (treadmill run)
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ height }}
    />
  );
}
