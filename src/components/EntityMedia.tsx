"use client";

import { useEffect, useState } from "react";
import { FaImage } from "react-icons/fa";
import DescribeLocationMap from "./DescribeLocationMap";
import type { DescribeLocationPoint } from "@/lib/describeLocations";
import { imageKey } from "@/lib/entityMedia";

function DetailImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const filename = decodeURIComponent(new URL(src).pathname.split("/").at(-1) ?? "Image").replace(/_/g, " ");
  return (
    <a href={src} className="relative flex h-72 w-96 max-w-full shrink-0 items-center justify-center overflow-auto rounded-lg bg-gray-100 text-cyan-700 underline break-all dark:bg-gray-800 dark:text-cyan-300" target="_blank" rel="noopener noreferrer">
      {!failed && (
        <span aria-hidden="true" className={`pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none ${loadedSrc === src ? "opacity-0" : "opacity-100"}`}>
          <span className={`flex h-full w-full items-center justify-center bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 ${loadedSrc !== src ? "animate-pulse motion-reduce:animate-none" : ""}`}>
            <FaImage className="h-12 w-12" />
          </span>
        </span>
      )}
      {failed ? src : (
        // SPARQL results may reference images on any host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={filename} className={`relative h-full w-full object-contain transition-opacity duration-300 motion-reduce:transition-none ${loadedSrc === src ? "opacity-100" : "opacity-0"}`}
          loading="lazy" decoding="async" onLoad={() => setLoadedSrc(src)} onError={() => setFailed(true)} />
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
