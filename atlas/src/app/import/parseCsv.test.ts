import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRows } from "./parseCsv.js";

describe("parseCsvRows", () => {
  it("splits plain comma-separated rows", () => {
    expect(parseCsvRows("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    const text = 'title,note\n"Escalier, raide","Il dit ""attention"""';
    expect(parseCsvRows(text)).toEqual([
      ["title", "note"],
      ["Escalier, raide", 'Il dit "attention"'],
    ]);
  });

  it("accepts CRLF and LF line endings in the same file", () => {
    expect(parseCsvRows("a,b\r\n1,2\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsvRows("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsv", () => {
  it("turns rows into point features and everything else into properties", () => {
    const csv = "fiche_id,lat,lon,secteur,note_obs\nF001,43.2864,5.3528,Vallon,Escaliers";
    const result = parseCsv(csv);
    expect(result.features).toHaveLength(1);
    const feature = result.features[0]!;
    expect(feature.geometry).toEqual({ type: "Point", coordinates: [5.3528, 43.2864] });
    expect(feature.properties).toEqual({ fiche_id: "F001", secteur: "Vallon", note_obs: "Escaliers" });
  });

  it("accepts the alternate column name spellings", () => {
    for (const [latCol, lonCol] of [
      ["lat", "lon"],
      ["latitude", "longitude"],
      ["coord_y", "coord_x"],
      ["y", "x"],
    ]) {
      const csv = `${latCol},${lonCol}\n43.28,5.36`;
      expect(parseCsv(csv).features).toHaveLength(1);
    }
  });

  it("rejects a row with unreadable coordinates but keeps the rest", () => {
    const csv = "lat,lon,note\n43.28,5.36,ok\nnope,also-nope,bad";
    const result = parseCsv(csv);
    expect(result.features).toHaveLength(1);
    expect(result.rejected).toEqual([{ index: 1, reason: "coordonnees manquantes ou illisibles" }]);
  });

  it("rejects coordinates outside EPSG:4326, e.g. lat/lon swapped", () => {
    // 43.28 is a plausible longitude but not a latitude; catches the classic
    // lat/lon transposition rather than silently misplacing the point.
    const csv = "lat,lon\n120,43.28";
    const result = parseCsv(csv);
    expect(result.features).toHaveLength(0);
    expect(result.rejected[0]!.reason).toMatch(/EPSG:4326/);
  });

  it("throws a readable error when coordinate columns are missing", () => {
    expect(() => parseCsv("nom,note\na,b")).toThrow(/Colonnes de coordonnees/);
  });

  it("throws on an empty file or header-only file", () => {
    expect(() => parseCsv("")).toThrow(/vide/);
    expect(() => parseCsv("lat,lon")).toThrow(/vide/);
  });

  it("collects property keys across all rows for the mapping wizard", () => {
    const csv = "lat,lon,a,b\n1,1,x,\n2,2,,y";
    expect(parseCsv(csv).propertyKeys).toEqual(["a", "b"]);
  });
});
