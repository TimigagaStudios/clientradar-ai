export type ParsedMapLink = {
  mapLink: string;
  businessName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export function parseMapLink(value: string): ParsedMapLink | null {
  try {
    const url = new URL(value.trim());
    const coordinate = url.searchParams.get('coordinate') || url.searchParams.get('ll');
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (coordinate) {
      const [lat, lng] = coordinate.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) { latitude = lat; longitude = lng; }
    }
    if (latitude === undefined || longitude === undefined) {
      const match = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (match) { latitude = Number(match[1]); longitude = Number(match[2]); }
    }
    const name = url.searchParams.get('name') || url.searchParams.get('q') || undefined;
    const address = url.searchParams.get('address') || undefined;
    if (!name && !address && latitude === undefined) return null;
    return { mapLink: value.trim(), businessName: name ? decodeURIComponent(name) : undefined, address: address ? decodeURIComponent(address) : undefined, latitude, longitude };
  } catch { return null; }
}
