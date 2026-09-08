import { DEFAULT_CONFIG } from "../../domain/config.js";
import { DIMENSIONS } from "../../domain/dimensions.js";
import { useAppStore } from "../state.js";

/**
 * Why a cell scored what it scored: the per-dimension figure, what the ruptures
 * did to it, how much evidence stands behind it, and which observations carried
 * the most weight.
 */
export function CellInspector() {
  const selectedCell = useAppStore((s) => s.selectedCell);
  const cellScores = useAppStore((s) => s.cellScores);
  const globalMode = useAppStore((s) => s.globalMode);
  const select = useAppStore((s) => s.selectCell);

  const cell = cellScores.find((c) => c.cell === selectedCell);
  if (!cell) return null;

  const max = DEFAULT_CONFIG.scaleMax;

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">Cellule</h2>
        <button type="button" onClick={() => select(null)} className="text-xs underline">
          Fermer
        </button>
      </div>

      <p className="text-xs text-slate-600">
        <span className="font-mono">{cell.cell}</span>
      </p>

      <div className="rounded bg-slate-100 p-2 text-sm">
        <p>
          <strong>
            Score {globalMode === "weakest_link" ? "(maillon faible)" : "(moyenne ponderee)"} :{" "}
            {cell.global === null ? "non calculable" : `${cell.global.toFixed(2)} / ${max}`}
          </strong>
        </p>
        <p className="text-xs">
          Confiance {cell.confidence.toFixed(2)} —{" "}
          {cell.sufficient ? "suffisante" : "insuffisante, a confirmer sur le terrain"}
        </p>
        {cell.limitingDimension && (
          <p className="text-xs">Dimension limitante : {cell.limitingDimension}</p>
        )}
      </div>

      <table className="w-full border-collapse text-left text-xs">
        <caption className="mb-1 text-left text-xs text-slate-600">Detail par dimension</caption>
        <thead>
          <tr className="border-b border-slate-300">
            <th scope="col" className="py-1 pr-2">Dimension</th>
            <th scope="col" className="py-1 pr-2">Note</th>
            <th scope="col" className="py-1 pr-2">Ecart</th>
            <th scope="col" className="py-1">Ruptures</th>
          </tr>
        </thead>
        <tbody>
          {DIMENSIONS.map((meta) => {
            const entry = cell.dimensions[meta.key];
            const capped = entry.raw !== null && entry.score !== null && entry.score < entry.raw;
            return (
              <tr key={meta.key} className="border-b border-slate-100 align-top">
                <th scope="row" className="py-1 pr-2 font-normal">{meta.mjslCode}</th>
                <td className="py-1 pr-2">
                  {entry.score === null ? "—" : entry.score.toFixed(2)}
                  {capped && (
                    <span className="block text-[10px] text-red-800">
                      ramene de {entry.raw!.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="py-1 pr-2">
                  {entry.min === null ? "—" : entry.min === entry.max ? "accord" : `${entry.min}–${entry.max}`}
                </td>
                <td className="py-1">
                  {entry.ruptures.blockingIds.length > 0 && `${entry.ruptures.blockingIds.length} blocage(s)`}
                  {entry.ruptures.frictionIds.length > 0 && ` ${entry.ruptures.frictionIds.length} friction(s)`}
                  {entry.ruptures.blockingIds.length + entry.ruptures.frictionIds.length === 0 && "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(() => {
        const contributions = DIMENSIONS.flatMap((meta) =>
          cell.dimensions[meta.key].contributions.map((c) => ({ ...c, dimension: meta.mjslCode })),
        )
          .sort((a, b) => b.share - a.share)
          .slice(0, 5);
        if (contributions.length === 0) return null;
        return (
          <div>
            <p className="mb-1 text-xs font-medium">Observations les plus determinantes</p>
            <ul className="space-y-1 text-xs">
              {contributions.map((c) => (
                <li key={`${c.dimension}-${c.observationId}`}>
                  {c.dimension} · {c.title} — note {c.score}, poids {(c.share * 100).toFixed(0)} %
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}
