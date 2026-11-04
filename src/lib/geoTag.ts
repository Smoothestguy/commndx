export function geoCoordinates(lat: number | null | undefined, lng: number | null | undefined): string | null {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : null;
}
export function geoMapHref(lat: number | null | undefined, lng: number | null | undefined): string | null {
  return geoCoordinates(lat, lng) ? `https://maps.google.com/?q=${lat},${lng}` : null;
}