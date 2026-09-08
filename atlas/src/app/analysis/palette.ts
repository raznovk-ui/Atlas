import type { ScoringConfig } from "../../domain/config.js";

/**
 * Viridis, sampled at four stops.
 *
 * Deliberately not the red/orange/yellow/green MJSL class palette: that ramp is
 * red-green, which is exactly the pair most colour-blind readers cannot
 * separate, and the spec requires a colour-blind-safe scale. Viridis is also
 * monotonic in luminance, so the choropleth still reads when a planche is
 * printed in greyscale. Swap STOPS if planche consistency matters more.
 */
export const STOPS = ["#440154", "#31688e", "#35b779", "#fde725"] as const;

export const INSUFFICIENT_FILL = "#e2e8f0";
export const INSUFFICIENT_LINE = "#64748b";

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Linear interpolation across the stops. `t` is clamped to 0..1. */
export function rampColour(t: number): string {
  if (!Number.isFinite(t)) return INSUFFICIENT_FILL;
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (STOPS.length - 1);
  const index = Math.min(STOPS.length - 2, Math.floor(scaled));
  const frac = scaled - index;

  const from = hexToRgb(STOPS[index]!);
  const to = hexToRgb(STOPS[index + 1]!);
  return rgbToHex([
    from[0] + (to[0] - from[0]) * frac,
    from[1] + (to[1] - from[1]) * frac,
    from[2] + (to[2] - from[2]) * frac,
  ]);
}

export function scoreColour(score: number | null, config: ScoringConfig): string {
  if (score === null) return INSUFFICIENT_FILL;
  return rampColour(config.scaleMax === 0 ? 0 : score / config.scaleMax);
}

/** Legend entries, worst first, labelled with the MJSL class vocabulary. */
export function legendEntries(config: ScoringConfig) {
  const max = config.scaleMax;
  return [
    { label: `0 – excluant`, colour: rampColour(0) },
    { label: `${(max / 3).toFixed(1)} – faible`, colour: rampColour(1 / 3) },
    { label: `${((2 * max) / 3).toFixed(1)} – acceptable`, colour: rampColour(2 / 3) },
    { label: `${max} – capacitant`, colour: rampColour(1) },
  ];
}
