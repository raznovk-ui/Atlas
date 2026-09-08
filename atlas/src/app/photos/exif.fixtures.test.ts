import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPhotoMetadata } from "./exif.js";

/**
 * Parses real JPEG bytes rather than a hand-built object. The previous version
 * of readPhotoMetadata passed a `pick` list that suppressed the GPS tags, so
 * every photo came back needing manual placement; only a real file catches it.
 */
const fixture = (name: string) => {
  const bytes = readFileSync(join(import.meta.dirname, "__fixtures__", name));
  return new File([bytes], name, { type: "image/jpeg" });
};

describe("readPhotoMetadata on real JPEG bytes", () => {
  it("recovers GPS, capture time and bearing", async () => {
    const result = await readPhotoMetadata(fixture("vallon-escalier.jpg"));
    expect(result.coordinates![0]).toBeCloseTo(5.3528, 4);
    expect(result.coordinates![1]).toBeCloseTo(43.2864, 4);
    expect(result.takenAt).toBe("2026-06-14T07:30:00.000Z");
    expect(result.bearing).toBe(212.5);
    expect(result.needsPlacement).toBe(false);
  });

  it("handles a photo with GPS but no bearing", async () => {
    const result = await readPhotoMetadata(fixture("corniche-belvedere.jpg"));
    expect(result.coordinates![1]).toBeCloseTo(43.2707, 4);
    expect(result.bearing).toBeNull();
    expect(result.needsPlacement).toBe(false);
  });

  it("flags a photo with no EXIF for manual placement instead of throwing", async () => {
    const result = await readPhotoMetadata(fixture("sans-gps.jpg"));
    expect(result.coordinates).toBeNull();
    expect(result.needsPlacement).toBe(true);
  });
});
