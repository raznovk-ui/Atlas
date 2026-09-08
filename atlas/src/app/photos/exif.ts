/**
 * EXIF extraction, split so the mapping logic is testable without a browser:
 * `readPhotoMetadata` does IO, `toPhotoMetadata` is pure.
 */
export interface RawExif {
  latitude?: number;
  longitude?: number;
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  GPSImgDirection?: number;
  GPSImgDirectionRef?: string;
  Orientation?: number;
}

export interface PhotoMetadata {
  coordinates: [number, number] | null;
  /** ISO date the photo was taken, null when EXIF carries none. */
  takenAt: string | null;
  /** Compass bearing in degrees, 0..360. */
  bearing: number | null;
  /** True when the photo must be placed on the map by hand. */
  needsPlacement: boolean;
}

function toIso(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validCoordinate(lng: unknown, lat: unknown): [number, number] | null {
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  // Exactly (0, 0) is Null Island: almost always a camera writing empty GPS
  // rather than a photo taken in the Atlantic.
  if (lng === 0 && lat === 0) return null;
  return [lng, lat];
}

export function toPhotoMetadata(exif: RawExif | null | undefined): PhotoMetadata {
  const coordinates = exif ? validCoordinate(exif.longitude, exif.latitude) : null;
  const bearingRaw = exif?.GPSImgDirection;
  const bearing =
    typeof bearingRaw === "number" && Number.isFinite(bearingRaw)
      ? ((bearingRaw % 360) + 360) % 360
      : null;

  return {
    coordinates,
    takenAt: toIso(exif?.DateTimeOriginal ?? exif?.CreateDate),
    bearing,
    needsPlacement: coordinates === null,
  };
}

export async function readPhotoMetadata(file: Blob): Promise<PhotoMetadata> {
  try {
    const exifr = await import("exifr");
    // No `pick` here: restricting the tag list also suppresses the GPSLatitude
    // and GPSLongitude tags exifr needs to derive `latitude`/`longitude`, which
    // silently sent every photo down the manual-placement path.
    // The bytes are read here rather than handing exifr a File: exifr would
    // reach for FileReader, which ties this to a browser for no benefit.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = (await exifr.parse(bytes, { gps: true })) as RawExif | undefined;
    return toPhotoMetadata(parsed);
  } catch (error) {
    // A photo without readable EXIF is still usable; it just has to be placed.
    console.warn("EXIF illisible", error);
    return toPhotoMetadata(null);
  }
}
