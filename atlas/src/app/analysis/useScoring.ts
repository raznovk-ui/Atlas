import { useEffect } from "react";
import { scoreAllCells } from "../../domain/scoring/cell.js";
import { detectRedZones } from "../../domain/scoring/redzones.js";
import { useAppStore } from "../state.js";

/**
 * Recomputes cellScores/cellCount/redZones whenever the inputs that affect
 * them change. Mounted once at the app root, not inside MapView: the
 * dashboard and the Analyse tab both read this data, and neither should
 * depend on whether the map has finished loading -- which, on top of being
 * bad architecture, is also the difference between "0 cellules" and real
 * numbers in an environment where the map's own load event never fires.
 */
export function useScoring() {
  const observations = useAppStore((s) => s.observations);
  const ruptures = useAppStore((s) => s.ruptures);
  const globalMode = useAppStore((s) => s.globalMode);
  const scoringConfig = useAppStore((s) => s.scoringConfig);

  useEffect(() => {
    const config = scoringConfig();
    const cells = scoreAllCells(observations, ruptures, config);
    const zones = detectRedZones(cells, ruptures, config);
    useAppStore.setState({ cellScores: cells, cellCount: cells.length, redZones: zones });
    // globalMode is read through scoringConfig(), but is not itself a
    // dependency scoringConfig captures automatically -- listed explicitly so
    // toggling the aggregation mode actually retriggers this.
  }, [observations, ruptures, globalMode, scoringConfig]);
}
