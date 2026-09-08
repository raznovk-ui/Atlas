/** Vieux-Port -> Statue de David, the MJSL corridor. Single source of truth. */
export const STUDY_AREA = {
  name: "Littoral marseillais - Vieux-Port a la Statue de David",
  bbox: { south: 43.255, west: 5.335, north: 43.305, east: 5.385 },
  centre: [5.36, 43.28] as [number, number],
  zoom: 13.2,
} as const;

export const OVERPASS_BBOX = `${STUDY_AREA.bbox.south},${STUDY_AREA.bbox.west},${STUDY_AREA.bbox.north},${STUDY_AREA.bbox.east}`;
