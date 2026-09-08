import { describe, expect, it } from "vitest";
import { toPhotoMetadata } from "./exif.js";

describe("toPhotoMetadata", () => {
  it("reads coordinates, date and bearing", () => {
    const result = toPhotoMetadata({
      longitude: 5.3528,
      latitude: 43.2864,
      DateTimeOriginal: new Date("2026-06-14T09:30:00Z"),
      GPSImgDirection: 212.5,
    });
    expect(result.coordinates).toEqual([5.3528, 43.2864]);
    expect(result.takenAt).toBe("2026-06-14T09:30:00.000Z");
    expect(result.bearing).toBe(212.5);
    expect(result.needsPlacement).toBe(false);
  });

  it("flags a photo with no EXIF at all for manual placement", () => {
    const result = toPhotoMetadata(null);
    expect(result.coordinates).toBeNull();
    expect(result.takenAt).toBeNull();
    expect(result.needsPlacement).toBe(true);
  });

  it("treats Null Island as missing GPS, not as a location", () => {
    expect(toPhotoMetadata({ longitude: 0, latitude: 0 }).needsPlacement).toBe(true);
  });

  it("rejects out-of-range and non-numeric coordinates", () => {
    expect(toPhotoMetadata({ longitude: 999, latitude: 43 }).coordinates).toBeNull();
    expect(toPhotoMetadata({ longitude: NaN, latitude: 43 }).coordinates).toBeNull();
    expect(toPhotoMetadata({ latitude: 43 }).coordinates).toBeNull();
  });

  it("normalises bearing into 0..360", () => {
    expect(toPhotoMetadata({ GPSImgDirection: 370 }).bearing).toBe(10);
    expect(toPhotoMetadata({ GPSImgDirection: -90 }).bearing).toBe(270);
    expect(toPhotoMetadata({ GPSImgDirection: 0 }).bearing).toBe(0);
  });

  it("falls back to CreateDate and tolerates an unparseable date", () => {
    expect(toPhotoMetadata({ CreateDate: "2026-01-02T03:04:05Z" }).takenAt).toBe("2026-01-02T03:04:05.000Z");
    expect(toPhotoMetadata({ DateTimeOriginal: "pas une date" }).takenAt).toBeNull();
  });
});
