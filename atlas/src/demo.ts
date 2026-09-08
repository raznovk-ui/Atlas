/**
 * Runs the scoring engine over the real MJSL layers in ../site/data and prints
 * what it finds. No UI yet -- this is how you inspect step 1.
 *
 *   npm run demo
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { FeatureCollection } from "geojson";
import { DIMENSIONS } from "./domain/dimensions.js";
import { withConfig } from "./domain/config.js";
import { importMjslProject } from "./domain/mjsl/import.js";
import { scoreAllCells } from "./domain/scoring/cell.js";
import { detectRedZones } from "./domain/scoring/redzones.js";

const DATA_DIR = join(process.cwd(), "..", "site", "data");

function loadLayers(): Record<string, FeatureCollection> {
  const layers: Record<string, FeatureCollection> = {};
  for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".geojson"))) {
    layers[file.replace(".geojson", "")] = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
  }
  return layers;
}

function rule(title: string) {
  console.log(`\n${title}\n${"-".repeat(title.length)}`);
}

const config = withConfig();
const layers = loadLayers();
const imported = importMjslProject(layers, config);

rule("Import");
console.log(`layers            ${Object.keys(layers).length}`);
console.log(`observations      ${imported.observations.length}`);
console.log(`ruptures          ${imported.ruptures.length}  (${imported.ruptures.filter((r) => r.blocking).length} bloquante(s))`);
console.log(`rejected          ${imported.rejected.length}`);
const dated = imported.observations.filter((o) => o.observedAt).length;
console.log(`with date_obs     ${dated} / ${imported.observations.length}`);

const cells = scoreAllCells(imported.observations, imported.ruptures, config);

rule(`Cells (H3 res ${config.h3Resolution}, echelle 0-${config.scaleMax}, mode ${config.globalMode})`);
console.log(`cells touched     ${cells.length}`);
console.log(`above confidence  ${cells.filter((c) => c.sufficient).length}  (seuil ${config.minConfidence})`);

rule("Couverture par dimension");
for (const meta of DIMENSIONS) {
  const scored = cells.filter((c) => c.dimensions[meta.key].score !== null);
  const values = scored.map((c) => c.dimensions[meta.key].score!);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  console.log(
    `${meta.mjslCode} ${meta.label.padEnd(30)} ${String(scored.length).padStart(4)} cells   ` +
      (mean === null ? "moyenne    -" : `moyenne ${mean.toFixed(2)}`),
  );
}

rule("Modes d'agregation compares");
for (const mode of ["weakest_link", "weighted_average"] as const) {
  const scored = scoreAllCells(imported.observations, imported.ruptures, withConfig({ globalMode: mode }));
  const globals = scored.map((c) => c.global).filter((g): g is number => g !== null);
  const mean = globals.length ? globals.reduce((a, b) => a + b, 0) / globals.length : 0;
  console.log(`${mode.padEnd(18)} moyenne ${mean.toFixed(2)}   min ${Math.min(...globals).toFixed(2)}   max ${Math.max(...globals).toFixed(2)}`);
}

rule("Zones rouges");
const zones = detectRedZones(cells, imported.ruptures, config);
if (zones.length === 0) {
  console.log("Aucune, et c'est le resultat correct : les 14 objets sont des");
  console.log("valeurs indicatives sans date_obs, donc sous le seuil de confiance.");
  console.log("Ce que le moteur trouverait si la confiance n'etait pas exigee :");
  const permissive = withConfig({ minConfidence: 0 });
  const scored = scoreAllCells(imported.observations, imported.ruptures, permissive);
  for (const zone of detectRedZones(scored, imported.ruptures, permissive).slice(0, 3)) {
    console.log(`\n  ${zone.id}  severite ${zone.severityIndex.toFixed(2)}  confiance ${zone.meanConfidence.toFixed(2)}`);
    console.log(`  ${zone.summary}`);
  }
} else {
  for (const zone of zones.slice(0, 5)) {
    console.log(`\n  ${zone.id}  severite ${zone.severityIndex.toFixed(2)}`);
    console.log(`  ${zone.summary}`);
  }
}
console.log();
