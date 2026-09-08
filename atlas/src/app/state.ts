import { create } from "zustand";
import type { FeatureCollection } from "geojson";
import type { Observation } from "../domain/types.js";
import {
  deleteObservations,
  deletePhotos,
  loadObservations,
  loadPhotos,
  savePhoto,
  saveObservations,
  type StoredPhoto,
} from "./persistence/db.js";
import { readPhotoMetadata, type PhotoMetadata } from "./photos/exif.js";
import { makeThumbnail } from "./photos/image.js";
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

  photos: StoredPhoto[];
  /** Photos whose EXIF carried no usable GPS, waiting to be placed by hand. */
  pendingPhotos: { photoId: string; filename: string; metadata: PhotoMetadata }[];
  placingPhotoId: string | null;
  loadStoredPhotos: () => Promise<void>;
  importPhotos: (files: File[]) => Promise<void>;
  startPlacingPhoto: (photoId: string | null) => void;
  placePhotoAt: (lng: number, lat: number) => Promise<void>;

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

  photos: [],
  pendingPhotos: [],
  placingPhotoId: null,

  loadStoredPhotos: async () => {
    set({ photos: await loadPhotos() });
  },

  importPhotos: async (files) => {
    if (files.length === 0) return;
    get().setStatus(`Lecture de ${files.length} photo(s)...`);

    const created: Observation[] = [];
    const pending: AppState["pendingPhotos"] = [];
    const stored: StoredPhoto[] = [];

    for (const file of files) {
      try {
        const metadata = await readPhotoMetadata(file);
        const photoId = `photo_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
        const photo: StoredPhoto = {
          id: photoId,
          filename: file.name,
          original: file,
          thumbnail: await makeThumbnail(file),
          mimeType: file.type,
          size: file.size,
        };
        await savePhoto(photo);
        stored.push(photo);

        if (metadata.coordinates) created.push(photoObservation(photoId, file.name, metadata, metadata.coordinates));
        else pending.push({ photoId, filename: file.name, metadata });
      } catch (error) {
        console.error(`Photo ignoree : ${file.name}`, error);
      }
    }

    if (created.length > 0) await saveObservations(created);
    set((s) => ({
      photos: [...s.photos, ...stored],
      observations: [...s.observations, ...created],
      pendingPhotos: [...s.pendingPhotos, ...pending],
    }));

    get().setStatus(
      `${created.length} photo(s) geolocalisee(s) ajoutee(s)` +
        (pending.length ? `, ${pending.length} a placer manuellement.` : "."),
    );
  },

  startPlacingPhoto: (photoId) =>
    set({
      placingPhotoId: photoId,
      addPointMode: false,
      status: photoId ? "Clique sur la carte pour placer la photo." : "Placement annule.",
    }),

  placePhotoAt: async (lng, lat) => {
    const photoId = get().placingPhotoId;
    if (!photoId) return;
    const entry = get().pendingPhotos.find((p) => p.photoId === photoId);
    if (!entry) return;

    const observation = photoObservation(photoId, entry.filename, entry.metadata, [lng, lat]);
    await saveObservations([observation]);
    set((s) => ({
      observations: [...s.observations, observation],
      pendingPhotos: s.pendingPhotos.filter((p) => p.photoId !== photoId),
      placingPhotoId: null,
      selectedObservationId: observation.id,
      status: `« ${entry.filename} » placee. Renseigne ses dimensions.`,
    }));
  },

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
    const photoIds = (removed.media ?? []).map((m) => m.id);
    if (photoIds.length > 0) await deletePhotos(photoIds);
    set((s) => ({
      observations: s.observations.filter((o) => o.id !== id),
      photos: s.photos.filter((p) => !photoIds.includes(p.id)),
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

function photoObservation(
  photoId: string,
  filename: string,
  metadata: PhotoMetadata,
  coordinates: [number, number],
): Observation {
  return {
    id: `obs_${photoId}`,
    geometry: { type: "Point", coordinates },
    source: "photo",
    title: filename,
    ratings: [],
    media: [
      {
        id: photoId,
        filename,
        coordinates: metadata.coordinates ?? undefined,
        bearing: metadata.bearing ?? undefined,
        takenAt: metadata.takenAt ?? undefined,
      },
    ],
    tags: [],
    createdAt: new Date().toISOString(),
    // The EXIF capture time is a genuine observation date. Absent it, the field
    // stays empty rather than borrowing the upload time.
    observedAt: metadata.takenAt ?? undefined,
  };
}
