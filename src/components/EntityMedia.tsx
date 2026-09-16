"use client";

import { useEffect, useState } from "react";
import DescribeLocationMap from "./DescribeLocationMap";
import type { DescribeLocationPoint } from "@/lib/describeLocations";
import { imageKey } from "@/lib/entityMedia";

function DetailImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const filename = decodeURIComponent(new URL(src).pathname.split("/").at(-1) ?? "Image").replace(/_/g, " ");
  return (
    <a href={src} className="inline-block max-w-full text-cyan-700 underline dark:text-cyan-300" target="_blank" rel="noopener noreferrer">
      {failed ? src : (
        // SPARQL results may reference images on any host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={filename} className="max-h-72 max-w-full rounded-lg object-contain"
          loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
    </a>
  );
}

export default function EntityMedia({ images, points }: { images: string[]; points: DescribeLocationPoint[] }) {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const syncTheme = () => setIsDark(document.documentElement.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  if (!images.length && !points.length) return null;
  return (
    <section className="mt-3 space-y-4 border-t border-gray-200 pt-3 dark:border-gray-600" aria-label="Images and locations">
      {images.length > 0 && <div className="flex flex-wrap items-start gap-3">
        {images.map((src) => <DetailImage key={imageKey(src)} src={src} />)}
      </div>}
      {points.length > 0 && <div className="space-y-2">
        <DescribeLocationMap isDark={isDark} points={points} />
        <div className="flex flex-wrap gap-3 text-xs">
          {points.map((point) => <a key={point.id} className="underline" target="_blank" rel="noopener noreferrer"
            href={`https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=12/${point.latitude}/${point.longitude}`}>
            {point.label}: {point.latitude}, {point.longitude} — Open in OSM
          </a>)}
        </div>
      </div>}
    </section>
  );
}
