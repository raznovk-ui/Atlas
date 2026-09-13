import { dimension as dimensionMeta } from "../../domain/dimensions.js";
import { useAppStore } from "../state.js";

export function RedZoneList() {
  const zones = useAppStore((s) => s.redZones);
  const cellCount = useAppStore((s) => s.cellCount);

  return (
    <section aria-labelledby="zones-heading" className="card">
      <h2 id="zones-heading" className="card-title">
        Zones rouges ({zones.length})
      </h2>

      {zones.length === 0 && (
        <p className="text-xs text-slate-600">
          {cellCount === 0
            ? "Aucune donnee a agreger pour l'instant."
            : "Aucune zone rouge. Soit les scores sont au-dessus du seuil, soit la confiance est trop basse pour conclure : une zone n'est retenue que si elle est reellement documentee."}
        </p>
      )}

      <ol className="space-y-2">
        {zones.map((zone, index) => (
          <li key={zone.id} className="rounded border border-red-900/40 p-2">
            <p className="text-sm font-medium">
              #{index + 1} — indice de severite {zone.severityIndex.toFixed(1)}
            </p>
            <p className="text-xs text-slate-700">{zone.summary}</p>
            <p className="mt-1 text-xs text-slate-600">
              {zone.areaCells} cellule(s) · {zone.blockingRuptureIds.length} blocage(s) dur(s) ·
              confiance {zone.meanConfidence.toFixed(2)}
            </p>
            {zone.dominantDimensions.length > 0 && (
              <p className="text-xs text-slate-600">
                Dimensions en cause : {zone.dominantDimensions.map((d) => dimensionMeta(d).label).join(", ")}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
