import { describe, expect, it } from "vitest";
import { describeRupture } from "./ruptureStyle.js";
import { withConfig } from "../domain/config.js";
import type { RupturePoint } from "../domain/types.js";

const base: RupturePoint = {
  id: "r1",
  geometry: { type: "Point", coordinates: [5.35, 43.28] },
  dimensions: ["physical"],
  severity: 3,
  blocking: true,
  createdAt: "2026-09-09T00:00:00Z",
};

describe("describeRupture", () => {
  it("says a maximum blocking rupture caps the dimension at zero", () => {
    expect(describeRupture(base)).toMatch(/plafonne .* a 0 \/ 3/);
  });

  it("reports the surviving ceiling for a partial block", () => {
    expect(describeRupture({ ...base, severity: 1 })).toMatch(/plafonne .* a 2 \/ 3/);
  });

  it("reports friction as a subtraction, not a ceiling", () => {
    const text = describeRupture({ ...base, blocking: false, severity: 3 });
    expect(text).toMatch(/Friction/);
    expect(text).toMatch(/retire 1.00/);
  });

  it("names every dimension the rupture is tagged with", () => {
    const text = describeRupture({ ...base, dimensions: ["physical", "economic"] });
    expect(text).toContain("Physique et continuite");
    expect(text).toContain("Economique et couts");
  });

  it("follows a reconfigured scale", () => {
    const text = describeRupture({ ...base, severity: 5 }, withConfig({ scaleMax: 5 }));
    expect(text).toMatch(/a 0 \/ 5/);
  });
});
