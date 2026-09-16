import type { DescribeQuad } from "./describe-types";
import { extractDescribeLocationPoints, type DescribeLocationPoint } from "./describeLocations";
import type { SparqlResults } from "./sparql-results";

export function imageUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!/\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(decodeURIComponent(url.pathname))) return null;
    if (url.hostname === "commons.wikimedia.org" || url.hostname === "upload.wikimedia.org") url.protocol = "https:";
    return url.href;
  } catch {
    return null;
  }
}

export function imageKey(src: string): string {
  const url = new URL(src);
  // Different requested thumbnail sizes still represent the same Commons file.
  if (url.hostname === "commons.wikimedia.org" && /\/Special:FilePath\//i.test(url.pathname)) {
    return `commons:${decodeURIComponent(url.pathname.split(/\/Special:FilePath\//i)[1]).replace(/_/g, " ")}`;
  }
  url.hash = "";
  return url.href;
}

function point(value: string): [number, number] | null {
  // Unqualified WKT and CRS84 use longitude, latitude order.
  const match = value.trim().match(/^(?:<http:\/\/www\.opengis\.net\/def\/crs\/OGC\/1\.3\/CRS84>\s*)?POINT\s*\(\s*([-+\d.eE]+)\s+([-+\d.eE]+)\s*\)$/i);
  return match ? [Number(match[2]), Number(match[1])] : null;
}

export function collectMedia(iri: string, details: SparqlResults | null, quads: DescribeQuad[], describedIri: string) {
  const images = new Map<string, string>();
  const locations = new Map<string, DescribeLocationPoint>();
  const addImage = (value: string) => {
    const src = imageUrl(value);
    if (src && !images.has(imageKey(src))) images.set(imageKey(src), src);
  };
  const addLocation = (latitude: number, longitude: number, label: string) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
    const id = `${latitude},${longitude}`;
    if (!locations.has(id)) locations.set(id, { id, latitude, longitude, label });
  };
  for (const location of extractDescribeLocationPoints(quads, describedIri)) {
    addLocation(location.latitude, location.longitude, location.label);
  }
  for (const quad of quads) {
    if (quad.object.termType === "NamedNode" || quad.object.termType === "Literal") addImage(quad.object.value);
    if (quad.object.termType === "Literal") {
      const coordinates = point(quad.object.value);
      if (coordinates) addLocation(...coordinates, quad.subject.value);
    }
  }
  for (const row of details?.results?.bindings ?? []) {
    let latitude: number | undefined;
    let longitude: number | undefined;
    const label = row.label?.value ?? row.name?.value ?? iri;
    for (const [variable, binding] of Object.entries(row)) {
      if (binding.type === "bnode") continue;
      addImage(binding.value);
      const coordinates = point(binding.value);
      if (coordinates) addLocation(...coordinates, label);
      const name = variable.toLowerCase().replace(/[_-]/g, "");
      if (!binding.value.trim()) continue;
      if (["lat", "latitude"].includes(name)) latitude = Number(binding.value);
      if (["lon", "long", "lng", "longitude"].includes(name)) longitude = Number(binding.value);
    }
    if (latitude !== undefined && longitude !== undefined) addLocation(latitude, longitude, label);
  }
  return { images: Array.from(images.values()), points: Array.from(locations.values()) };
}
