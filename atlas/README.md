# MJSL Atlas — domain model and scoring engine

Step 1 of the multi-dimensional accessibility atlas: the domain model and the
scoring engine, headless. No UI, no map, no React, no network. Everything here
is pure and unit-tested, so the same module can run in the browser now and on a
server later without a rewrite.

```bash
npm install
npm test
npm run typecheck
```

## Settings in force

| Knob | Value | Why |
|---|---|---|
| Rating scale | 0–3, configurable | Keeps `grille_scoring_mjsl.csv`, the QGIS expressions and the mémoire valid. 0–5 is one config change. |
| H3 resolution | 10 (~76 m edge) | The MJSL protocol asks for 25–50 m segments; res 9 (~170 m) would swallow whole sequences of the Corniche. |
| Global mode | `weakest_link` | One hard block ruins a route regardless of the other five dimensions. `weighted_average` is available and both are tested. |
| Red-zone threshold | 2.0 | Starting point, not a truth. |
| Contributors | single-author | No auth, no roles, no conflict resolution in v1. |

All of it lives in `src/domain/config.ts`. Nothing downstream hardcodes a
constant.

## Rules the tests pin down

- **Absence of data is never a bad score.** An unrated dimension stays `null`
  and is excluded from the global score, rather than counting as zero.
- **Recency reads `observedAt` only.** `createdAt` is when a record was typed
  in. Falling back to it let an undated import date itself to the moment of
  import and score as fresh evidence.
- **A hard block dominates.** Rupture ceilings are applied *after* the weighted
  mean, not as one more sample inside it.
- **Confidence is separate from score.** A lone stale OSM rating and three
  corroborating fresh photos can both yield 2, and must never render alike.
- **Disagreement is shown, not smoothed.** Every dimension carries `min`/`max`
  and per-observation `share`.

## Severity direction

`RupturePoint.severity` runs 0..scaleMax with **higher meaning worse**, matching
the `gravite` column already in `mjsl_points_rupture`. The build spec wrote
severity as though it were score-like (low = worse); the existing data's
convention wins, and the conversion to a score ceiling happens in
`scoring/ruptures.ts`.

## Known approximations

- Polygon → cell assignment uses `polygonToCells` (cell centres inside the ring)
  with a centroid fallback, not exact turf intersection areas. Good to about one
  cell at the boundary.
- The red-zone severity index has no population term; there is no population
  raster wired in yet.
- `LAYER_FIELD_DIMENSIONS` in `mjsl/import.ts` is an interpretation of which
  legacy score column feeds which dimension. It needs checking against the
  mémoire.

## Not built yet

Steps 2–8: map shell, import wizard, EXIF photos, draw tools, choropleth,
dashboard, report export, accessibility pass.
