import { DEFAULT_CONFIG } from "../../domain/config.js";
import { useAppStore } from "../state.js";
import { RUPTURE_COLOURS } from "../ruptureStyle.js";
import { IconAlertTriangle } from "./icons.js";

export function RuptureList() {
  const ruptures = useAppStore((s) => s.ruptures);
  const selected = useAppStore((s) => s.selectedRuptureId);
  const select = useAppStore((s) => s.selectRupture);
  const addMode = useAppStore((s) => s.addRuptureMode);
  const toggle = useAppStore((s) => s.toggleAddRuptureMode);

  return (
    <section aria-labelledby="rup-heading" className="card">
      <h2 id="rup-heading" className="card-title">
        Points de rupture ({ruptures.length})
      </h2>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={addMode}
        className="btn btn-toggle-danger btn-block mb-2"
      >
        <IconAlertTriangle />
        {addMode ? "Clique sur la carte…" : "Signaler une rupture"}
      </button>

      {ruptures.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">
          Une rupture est ce qui coupe un cheminement ou exclut un groupe : marches sans alternative,
          seuil filtrant, trottoir interrompu.
        </p>
      )}

      <ul className="space-y-1.5">
        {ruptures.map((rupture) => {
          const isSelected = selected === rupture.id;
          return (
            <li key={rupture.id}>
              <button
                type="button"
                onClick={() => select(isSelected ? null : rupture.id)}
                aria-expanded={isSelected}
                className="block w-full rounded-md border p-2 pl-2.5 text-left transition-colors"
                style={{
                  borderColor: isSelected ? "var(--brand)" : "var(--line)",
                  background: isSelected ? "var(--brand-tint)" : "var(--surface)",
                  borderLeftWidth: "3px",
                  borderLeftColor: rupture.blocking ? RUPTURE_COLOURS.blocking : RUPTURE_COLOURS.friction,
                }}
              >
                <span className="block text-sm font-semibold text-slate-900">
                  {rupture.comment || "Rupture sans description"}
                </span>
                <span className="block text-xs text-slate-600">
                  {/* Spelled out, so the map colour is never the only signal. */}
                  {rupture.blocking ? "Blocage dur" : "Friction"} · gravite {rupture.severity} /{" "}
                  {DEFAULT_CONFIG.scaleMax} · {rupture.dimensions.join(", ") || "aucune dimension"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
