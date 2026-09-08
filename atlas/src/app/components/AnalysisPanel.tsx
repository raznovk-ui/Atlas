import { useId } from "react";
import { DIMENSIONS } from "../../domain/dimensions.js";
import { DEFAULT_CONFIG } from "../../domain/config.js";
import { INSUFFICIENT_FILL, legendEntries } from "../analysis/palette.js";
import { useAppStore } from "../state.js";

export function AnalysisPanel() {
  const activeLayer = useAppStore((s) => s.activeLayer);
  const setActiveLayer = useAppStore((s) => s.setActiveLayer);
  const globalMode = useAppStore((s) => s.globalMode);
  const setGlobalMode = useAppStore((s) => s.setGlobalMode);
  const showCells = useAppStore((s) => s.showCells);
  const toggleCells = useAppStore((s) => s.toggleCells);
  const opacity = useAppStore((s) => s.cellOpacity);
  const setOpacity = useAppStore((s) => s.setCellOpacity);
  const cellCount = useAppStore((s) => s.cellCount);
  const ids = useId();

  return (
    <section aria-labelledby="analysis-heading">
      <h2 id="analysis-heading" className="mb-2 text-sm font-semibold">
        Analyse ({cellCount} cellules)
      </h2>

      <label className="mb-2 flex gap-2 text-sm">
        <input type="checkbox" checked={showCells} onChange={toggleCells} className="mt-1" />
        <span>Afficher l&apos;agregation</span>
      </label>

      <div className="mb-3">
        <label htmlFor={`${ids}-layer`} className="block text-xs font-medium">
          Surface affichee
        </label>
        <select
          id={`${ids}-layer`}
          value={activeLayer}
          onChange={(e) => setActiveLayer(e.target.value as typeof activeLayer)}
          className="w-full rounded border border-slate-300 p-1 text-sm"
        >
          <option value="global">Score global</option>
          {DIMENSIONS.map((meta) => (
            <option key={meta.key} value={meta.key}>
              {meta.mjslCode} — {meta.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="mb-3 border-0 p-0">
        <legend className="mb-1 text-xs font-medium">Mode d&apos;agregation</legend>
        {/* Surfaced as a control rather than a constant: which of these you use
            is an argument about what counts as accessible, not a detail. */}
        {[
          {
            value: "weakest_link" as const,
            label: "Maillon faible",
            hint: "La dimension la plus basse fixe le score. Un blocage suffit a disqualifier un lieu.",
          },
          {
            value: "weighted_average" as const,
            label: "Moyenne ponderee",
            hint: "Les six dimensions se compensent. Un blocage peut etre masque par le reste.",
          },
        ].map((option) => (
          <label key={option.value} className="mb-1 flex gap-2 text-sm">
            <input
              type="radio"
              name={`${ids}-mode`}
              checked={globalMode === option.value}
              onChange={() => setGlobalMode(option.value)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-slate-600">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mb-3">
        <label htmlFor={`${ids}-opacity`} className="block text-xs font-medium">
          Opacite : {Math.round(opacity * 100)} %
        </label>
        <input
          id={`${ids}-opacity`}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium">Legende (0 a {DEFAULT_CONFIG.scaleMax})</p>
        <ul className="space-y-1">
          {legendEntries(DEFAULT_CONFIG).map((entry) => (
            <li key={entry.label} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-6 rounded-sm border border-slate-300"
                style={{ background: entry.colour }}
              />
              {entry.label}
            </li>
          ))}
          <li className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-6 rounded-sm border border-dashed border-slate-500"
              style={{ background: INSUFFICIENT_FILL }}
            />
            Donnees insuffisantes
          </li>
        </ul>
        <p className="mt-1 text-xs text-slate-600">
          Une cellule grise a trop peu de releves pour etre notee. Ce n&apos;est pas une mauvaise note.
        </p>
      </div>
    </section>
  );
}
