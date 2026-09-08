import { describe, expect, it } from "vitest";
import { withConfig } from "../config.js";
import { confidence } from "../scoring/confidence.js";
import { indexByCell, scoreCell } from "../scoring/cell.js";
import { latLngToCell } from "h3-js";
import { NOW, ORIGIN, obs } from "./helpers.js";

const config = withConfig();

describe("confidence", () => {
  it("rises with the number of observations", () => {
    const one = confidence({ effectiveCount: 1, distinctSources: 1, meanRecency: 1 }, config).value;
    const many = confidence({ effectiveCount: 10, distinctSources: 1, meanRecency: 1 }, config).value;
    expect(many).toBeGreaterThan(one);
  });

  it("rewards corroboration across different sources", () => {
    const single = confidence({ effectiveCount: 4, distinctSources: 1, meanRecency: 1 }, config).value;
    const diverse = confidence({ effectiveCount: 4, distinctSources: 3, meanRecency: 1 }, config).value;
    expect(diverse).toBeGreaterThan(single);
  });

  it("falls for stale evidence", () => {
    const fresh = confidence({ effectiveCount: 4, distinctSources: 2, meanRecency: 1 }, config).value;
    const stale = confidence({ effectiveCount: 4, distinctSources: 2, meanRecency: 0.3 }, config).value;
    expect(stale).toBeLessThan(fresh);
  });

  it("stays within 0..1", () => {
    const extreme = confidence({ effectiveCount: 1e6, distinctSources: 99, meanRecency: 1 }, config);
    expect(extreme.value).toBeLessThanOrEqual(1);
    expect(confidence({ effectiveCount: -5, distinctSources: -1, meanRecency: -1 }, config).value).toBe(0);
  });
});

describe("a lone unreliable rating never looks like a well-evidenced one", () => {
  function cellFor(observations: any[]) {
    const index = indexByCell(observations, [], config, NOW);
    return scoreCell(latLngToCell(ORIGIN[1], ORIGIN[0], config.h3Resolution), index, config);
  }

  it("gives the same score but different confidence", () => {
    const lone = cellFor([obs({ physical: 2 }, { source: "osm", observedAt: "2019-01-01T00:00:00Z" })]);
    const solid = cellFor([
      obs({ physical: 2 }, { source: "photo", observedAt: "2026-09-01T00:00:00Z" }),
      obs({ physical: 2 }, { source: "manual_note", observedAt: "2026-09-01T00:00:00Z" }),
      obs({ physical: 2 }, { source: "imported_geojson", observedAt: "2026-09-01T00:00:00Z" }),
    ]);

    expect(lone.dimensions.physical.score).toBeCloseTo(2, 6);
    expect(solid.dimensions.physical.score).toBeCloseTo(2, 6);
    expect(lone.confidence).toBeLessThan(solid.confidence);
    expect(lone.sufficient).toBe(false);
    expect(solid.sufficient).toBe(true);
  });
});
