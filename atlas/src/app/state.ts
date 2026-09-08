import { create } from "zustand";
import type { FeatureCollection } from "geojson";
import type { Observation } from "../domain/types.js";
import { deleteObservations, loadObservations, saveObservations } from "./persistence/db.js";
import { DEFAULT_BASEMAP } from "./map/basemaps.js";
import { OVERPASS_PRESETS } from "./overpass/presets.js";
import { loadPreset } from "./overpass/client.js";

export type LoadState = "idle" | "loading" | "ready" | "error";

interface PresetLayer {
  visible: boolean;
  state: LoadState;
  geojson: FeatureCollection | null;
  fromCache: boolean;
  timestamp: number | null;
  error: string | null;
}

interface AppState {
  basemap: string;
  setBasemap: (id: string) => void;

  presets: Record<string, PresetLayer>;
  togglePreset: (id: string) => void;
  fetchPreset: (id: string, options?: { forceRefresh?: boolean }) => Promise<void>;

  observations: Observation[];
  loadStoredObservations: () => Promise<void>;
  addObservations: (observations: Observation[]) => Promise<void>;
  updateObservation: (observation: Observation) => Promise<void>;
  removeObservation: (id: string) => Promise<void>;

  /** Last destructive action, so it can be undone. Deletes are the only one. */
  undo: { label: string; observations: Observation[] } | null;
  undoLast: () => Promise<void>;

  selectedObservationId: string | null;
  selectObservation: (id: string | null) => void;

  /** When on, a click on the map drops a new unrated point. */
  addPointMode: boolean;
  toggleAddPointMode: () => void;
  addPointAt: (lng: number, lat: number) => Promise<void>;

  /** Announced through an aria-live region, so progress is not colour-only. */
  status: string;
  setStatus: (message: string) => void;
}

const initialPresets = Object.fromEntries(
  OVERPASS_PRESETS.map((preset) => [
    preset.id,
    { visible: true, state: "idle" as LoadState, geojson: null, fromCache: false, timestamp: null, error: null },
  ]),
);

export const useAppStore = create<AppState>((set, get) => ({
  basemap: DEFAULT_BASEMAP,
  setBasemap: (id) => set({ basemap: id }),

  presets: initialPresets,

  observations: [],
  undo: null,
  selectedObservationId: null,
  selectObservation: (id) => set({ selectedObservationId: id }),

  addPointMode: false,
  toggleAddPointMode: () =>
    set((s) => {
      const addPointMode = !s.addPointMode;
      return {
        addPointMode,
        status: addPointMode ? "Clique sur la carte pour placer un point." : "Ajout de point desactive.",
      };
    }),

  addPointAt: async (lng, lat) => {
    const observation: Observation = {
      id: `obs_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      geometry: { type: "Point", coordinates: [lng, lat] },
      source: "manual_note",
      title: "Nouveau point",
      ratings: [],
      createdAt: new Date().toISOString(),
      // A point dropped in the field is observed now; that is a real date, not
      // the import-timestamp shortcut the engine refuses.
      observedAt: new Date().toISOString(),
      tags: [],
    };
    await saveObservations([observation]);
    set((s) => ({
      observations: [...s.observations, observation],
      selectedObservationId: observation.id,
      addPointMode: false,
      status: "Point ajoute. Renseigne ses dimensions dans le panneau de droite.",
    }));
  },

  loadStoredObservations: async () => {
    const observations = await loadObservations();
    set({ observations });
    if (observations.length > 0) {
      get().setStatus(`${observations.length} observation(s) rechargee(s) depuis ce navigateur.`);
    }
  },

  addObservations: async (incoming) => {
    if (incoming.length === 0) return;
    await saveObservations(incoming);
    set((s) => ({ observations: [...s.observations, ...incoming] }));
    get().setStatus(`${incoming.length} observation(s) ajoutee(s).`);
  },

  updateObservation: async (observation) => {
    await saveObservations([observation]);
    set((s) => ({ observations: s.observations.map((o) => (o.id === observation.id ? observation : o)) }));
    get().setStatus(`« ${observation.title} » mise a jour.`);
  },

  removeObservation: async (id) => {
    const removed = get().observations.find((o) => o.id === id);
    if (!removed) return;
    await deleteObservations([id]);
    set((s) => ({
      observations: s.observations.filter((o) => o.id !== id),
      selectedObservationId: s.selectedObservationId === id ? null : s.selectedObservationId,
      undo: { label: `Suppression de « ${removed.title} »`, observations: [removed] },
    }));
    get().setStatus(`« ${removed.title} » supprimee. Annulation possible.`);
  },

  undoLast: async () => {
    const pending = get().undo;
    if (!pending) return;
    await saveObservations(pending.observations);
    set((s) => ({ observations: [...s.observations, ...pending.observations], undo: null }));
    get().setStatus(`${pending.label} annulee.`);
  },

  status: "Pret.",
  setStatus: (message) => set({ status: message }),

  togglePreset: (id) =>
    set((s) => ({ presets: { ...s.presets, [id]: { ...s.presets[id]!, visible: !s.presets[id]!.visible } } })),

  fetchPreset: async (id, options = {}) => {
    const preset = OVERPASS_PRESETS.find((p) => p.id === id);
    if (!preset) return;

    const patch = (partial: Partial<PresetLayer>) =>
      set((s) => ({ presets: { ...s.presets, [id]: { ...s.presets[id]!, ...partial } } }));

    patch({ state: "loading", error: null });
    get().setStatus(`Chargement de « ${preset.label} »...`);

    try {
      const result = await loadPreset(preset, options);
      patch({
        state: "ready",
        geojson: result.geojson,
        fromCache: result.fromCache,
        timestamp: result.timestamp,
      });
      get().setStatus(
        `${result.geojson.features.length} objets charges pour « ${preset.label} »` +
          (result.fromCache ? " (cache local)." : " (Overpass)."),
      );
    } catch (error) {
      patch({ state: "error", error: error instanceof Error ? error.message : String(error) });
      get().setStatus(`Echec du chargement de « ${preset.label} ». Verifie la connexion.`);
    }
  },
}));
