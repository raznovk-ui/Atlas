import { DEFAULT_CONFIG } from "../../domain/config.js";
import { useAppStore } from "../state.js";

export function RuptureList() {
  const ruptures = useAppStore((s) => s.ruptures);
  const selected = useAppStore((s) => s.selectedRuptureId);
  const select = useAppStore((s) => s.selectRupture);
  const addMode = useAppStore((s) => s.addRuptureMode);
  const toggle = useAppStore((s) => s.toggleAddRuptureMode);

  return (
    <section aria-labelledby="rup-heading">
      <h2 id="rup-heading" className="mb-2 text-sm font-semibold">
        Points de rupture ({ruptures.length})
      </h2>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={addMode}
        className={`mb-2 w-full rounded px-3 py-2 text-sm font-medium ${
          addMode ? "bg-red-900 text-white" : "border border-red-900 text-red-900 hover:bg-red-50"
        }`}
      >
        {addMode ? "Clique sur la carte…" : "Signaler une rupture"}
      </button>

      {ruptures.length === 0 && (
        <p className="text-xs text-slate-600">
          Une rupture est ce qui coupe un cheminement ou exclut un groupe : marches sans alternative,
          seuil filtrant, trottoir interrompu.
        </p>
      )}

      <ul className="space-y-1">
        {ruptures.map((rupture) => (
          <li key={rupture.id}>
            <button
              type="button"
              onClick={() => select(selected === rupture.id ? null : rupture.id)}
              aria-expanded={selected === rupture.id}
              className={`block w-full rounded border p-2 text-left ${
                selected === rupture.id ? "border-slate-900 bg-slate-50" : "border-slate-200"
              }`}
            >
              <span className="block text-sm font-medium">
                {rupture.comment || "Rupture sans description"}
              </span>
              <span className="block text-xs text-slate-600">
                {/* Spelled out, so the map colour is never the only signal. */}
                {rupture.blocking ? "Blocage dur" : "Friction"} · gravite {rupture.severity} /{" "}
                {DEFAULT_CONFIG.scaleMax} · {rupture.dimensions.join(", ") || "aucune dimension"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
