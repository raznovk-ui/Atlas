import { useEffect, useState } from "react";
import { MapView } from "./map/MapView.js";
import { BasemapPicker } from "./components/BasemapPicker.js";
import { LayerPanel } from "./components/LayerPanel.js";
import { DataTable } from "./components/DataTable.js";
import { StatusBar } from "./components/StatusBar.js";
import { OVERPASS_PRESETS } from "./overpass/presets.js";
import { STUDY_AREA } from "./studyArea.js";
import { useAppStore } from "./state.js";

type View = "map" | "table";

export function App() {
  const fetchPreset = useAppStore((s) => s.fetchPreset);
  const [view, setView] = useState<View>("map");

  useEffect(() => {
    // Fired without awaiting: a slow Overpass query must never hold the UI.
    for (const preset of OVERPASS_PRESETS) void fetchPreset(preset.id);
  }, [fetchPreset]);

  return (
    <div className="flex h-screen flex-col bg-white text-slate-900">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>

      <header className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Matrice de Justice Spatiale Littorale
        </p>
        <h1 className="text-lg font-bold">Atlas d'accessibilite multi-dimensionnelle</h1>
        <p className="text-sm text-slate-600">{STUDY_AREA.name}</p>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 p-4" aria-label="Reglages des couches">
          <div className="space-y-6">
            <BasemapPicker />
            <LayerPanel />
            <section aria-labelledby="limites">
              <h2 id="limites" className="mb-1 text-sm font-semibold">
                Limites
              </h2>
              <p className="text-xs text-slate-600">
                Les objets OSM sont des indices a verifier sur le terrain, pas des preuves. Cet outil ne
                remplace pas la consultation des personnes handicapees et des habitants concernes.
              </p>
            </section>
          </div>
        </aside>

        <main id="contenu" className="flex min-h-0 flex-1 flex-col">
          <nav aria-label="Mode d'affichage" className="border-b border-slate-200 px-4 py-2">
            <div role="tablist" className="flex gap-2">
              {(["map", "table"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={view === value}
                  onClick={() => setView(value)}
                  className={`rounded px-3 py-1 text-sm font-medium ${
                    view === value ? "bg-slate-900 text-white" : "border border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {value === "map" ? "Carte" : "Tableau"}
                </button>
              ))}
            </div>
          </nav>

          {/* The map stays mounted so MapLibre keeps its WebGL context. */}
          <div className={`min-h-0 flex-1 ${view === "map" ? "" : "hidden"}`}>
            <MapView />
          </div>
          <div className={`min-h-0 flex-1 overflow-y-auto ${view === "table" ? "" : "hidden"}`}>
            <DataTable />
          </div>

          <StatusBar />
        </main>
      </div>
    </div>
  );
}
