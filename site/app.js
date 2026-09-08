const MARSEILLE_BOUNDS = [
  [43.255, 5.335],
  [43.305, 5.385],
];

const ZOOMS = [
  { label: "Vieux-Port", center: [43.2946, 5.3698], zoom: 16 },
  { label: "Vallon des Auffes", center: [43.2864, 5.3528], zoom: 17 },
  { label: "Malmousque", center: [43.2819, 5.3482], zoom: 16 },
  { label: "Corniche Kennedy", center: [43.2707, 5.3609], zoom: 15 },
  { label: "Statue de David", center: [43.2622, 5.3664], zoom: 16 },
];

const DIMENSIONS = [
  { key: "D1", label: "D1 - Physique", fields: ["d1_physique"] },
  { key: "D2", label: "D2 - Sensorielle", fields: ["d2_sensoriel"] },
  { key: "D3", label: "D3 - Cognitive", fields: ["d3_cognitif"] },
  { key: "D4", label: "D4 - Economique", fields: ["d4_economique"] },
  { key: "D5", label: "D5 - Sociale", fields: ["d5_social"] },
  { key: "D6", label: "D6 - Democratique", fields: ["d6_democratique"] },
];

const CLASSES = ["excluant", "faible", "acceptable", "capacitant"];

const DATASETS = [
  {
    key: "mjsl_segments_cheminement",
    label: "Segments de cheminement",
    url: "./data/mjsl_segments_cheminement.geojson",
    dimensions: ["D1", "D2", "D3", "D4", "D5", "D6"],
  },
  {
    key: "mjsl_points_rupture",
    label: "Points de rupture",
    url: "./data/mjsl_points_rupture.geojson",
    dimensions: ["D1", "D2", "D3"],
  },
  {
    key: "mjsl_amenites_repos",
    label: "Amenites et repos",
    url: "./data/mjsl_amenites_repos.geojson",
    dimensions: ["D1", "D4", "D5"],
  },
  {
    key: "mjsl_ambiances",
    label: "Ambiances",
    url: "./data/mjsl_ambiances.geojson",
    dimensions: ["D2", "D3"],
  },
  {
    key: "mjsl_seuils_legitimite",
    label: "Seuils et legitimite",
    url: "./data/mjsl_seuils_legitimite.geojson",
    dimensions: ["D4", "D5"],
  },
  {
    key: "mjsl_transport_metropolitain",
    label: "Chaine metropolitaine",
    url: "./data/mjsl_transport_metropolitain.geojson",
    dimensions: ["D1", "D4", "D6"],
  },
  {
    key: "mjsl_participation",
    label: "Participation",
    url: "./data/mjsl_participation.geojson",
    dimensions: ["D6"],
  },
];

const SCORE_COLORS = {
  excluant: "#9e2f2f",
  faible: "#d9822b",
  acceptable: "#d7b84f",
  capacitant: "#3c8b5a",
  osm: "#277da1",
};

const map = L.map("map", {
  zoomControl: true,
}).fitBounds(MARSEILLE_BOUNDS);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const appState = {
  datasets: new Map(),
  layerVisibility: new Map(),
  activeDimensions: new Set(DIMENSIONS.map((dimension) => dimension.key)),
  activeClasses: new Set(CLASSES),
  category: "all",
  featureLayer: L.layerGroup().addTo(map),
};

const els = {
  status: document.getElementById("status"),
  details: document.getElementById("details"),
  layerFilters: document.getElementById("layerFilters"),
  dimensionFilters: document.getElementById("dimensionFilters"),
  classFilters: document.getElementById("classFilters"),
  categoryFilter: document.getElementById("categoryFilter"),
  fileInput: document.getElementById("fileInput"),
  loadMjslBtn: document.getElementById("loadMjslBtn"),
  loadOsmBtn: document.getElementById("loadOsmBtn"),
  exportBtn: document.getElementById("exportBtn"),
  zoomButtons: document.getElementById("zoomButtons"),
};

function setStatus(message) {
  els.status.textContent = message;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function average(values) {
  const numbers = values.map(toNumber).filter((value) => value !== null);
  if (!numbers.length) return null;
  return Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 100) / 100;
}

function classFromScore(score) {
  if (score === null || score === undefined) return "";
  if (score < 1) return "excluant";
  if (score < 2) return "faible";
  if (score < 2.6) return "acceptable";
  return "capacitant";
}

function scoreForFeature(properties, datasetKey) {
  const direct = average([
    properties.d1_physique,
    properties.d2_sensoriel,
    properties.d3_cognitif,
    properties.d4_economique,
    properties.d5_social,
    properties.d6_democratique,
  ]);
  if (direct !== null) return direct;

  const byDataset = {
    mjsl_points_rupture: [properties.score_associe],
    mjsl_amenites_repos: [properties.score_confort, properties.score_gratuite, properties.score_accessibilite],
    mjsl_ambiances: [properties.score_sensoriel, properties.score_cognitif],
    mjsl_seuils_legitimite: [properties.score_social, properties.score_economique],
    mjsl_transport_metropolitain: [properties.score_continuite, properties.score_cout, properties.score_lisibilite],
    mjsl_participation: [properties.score_accessibilite, properties.score_lisibilite, properties.score_reversibilite],
  };

  return average(byDataset[datasetKey] || []);
}

function enrichFeature(feature, dataset) {
  const enriched = JSON.parse(JSON.stringify(feature));
  const properties = enriched.properties || {};
  properties._dataset = dataset.key;
  properties._dataset_label = dataset.label;
  properties._dimensions = (dataset.dimensions || []).join(",");

  if (dataset.key !== "osm_indices") {
    const score = toNumber(properties.score_mjsl) ?? scoreForFeature(properties, dataset.key);
    properties._mjsl_score = score;
    properties._mjsl_class = properties.classe_mjsl || classFromScore(score);
    properties.score_mjsl = score ?? properties.score_mjsl ?? "";
    properties.classe_mjsl = properties._mjsl_class || properties.classe_mjsl || "";

    properties.cat_fragmentation = toNumber(properties.cat_fragmentation) ?? inferFragmentation(properties);
    properties.cat_metropolitaine = toNumber(properties.cat_metropolitaine) ?? inferMetropolitan(properties);
    properties.cat_privatisation = toNumber(properties.cat_privatisation) ?? inferPrivatization(properties);
  }

  enriched.properties = properties;
  return enriched;
}

// Une dimension absente n'est pas une dimension a zero : sans releve on ne deduit rien.
// `null <= 1` vaut `true` en JavaScript, ce qui classait tout objet non renseigne
// dans les trois categories d'exclusion a la fois.
function lowScore(value) {
  const number = toNumber(value);
  if (number === null) return null;
  return number <= 1 ? 1 : 0;
}

// 1 si au moins un critere renseigne est bas, 0 si tous sont renseignes et hauts,
// null si aucun critere n'est renseigne.
function anyLow(flags) {
  const known = flags.filter((flag) => flag !== null);
  if (!known.length) return null;
  return known.includes(1) ? 1 : 0;
}

function inferFragmentation(properties) {
  return anyLow([
    lowScore(properties.d1_physique),
    lowScore(properties.d2_sensoriel),
    lowScore(properties.d3_cognitif),
  ]);
}

function inferMetropolitan(properties) {
  const d1 = lowScore(properties.d1_physique);
  const d6 = lowScore(properties.d6_democratique);
  // La regle MJSL demande D1 <= 1 ET D6 <= 1 : indecidable si l'une des deux manque.
  const chain = d1 === null || d6 === null ? null : (d1 === 1 && d6 === 1 ? 1 : 0);
  return anyLow([
    chain,
    lowScore(properties.score_continuite),
    lowScore(properties.score_lisibilite),
  ]);
}

function inferPrivatization(properties) {
  return anyLow([
    lowScore(properties.d4_economique),
    lowScore(properties.d5_social),
  ]);
}

function colorForFeature(feature) {
  const properties = feature.properties || {};
  if (properties._dataset === "osm_indices") return SCORE_COLORS.osm;
  return SCORE_COLORS[properties._mjsl_class] || "#555";
}

function styleFeature(feature) {
  const color = colorForFeature(feature);
  const geomType = feature.geometry?.type || "";
  const isPolygon = geomType.includes("Polygon");

  return {
    color,
    weight: feature.properties?._dataset === "mjsl_segments_cheminement" ? 6 : 3,
    opacity: 0.92,
    fillColor: color,
    fillOpacity: isPolygon ? 0.26 : 0.12,
    dashArray: feature.properties?._dataset === "osm_indices" ? "5 5" : null,
  };
}

function pointToLayer(feature, latlng) {
  const dataset = feature.properties?._dataset;
  
  // 1. Afficher l'icône SVG Carto
  if (dataset === "osm_indices" && feature.properties.osm_iconPath) {
    const baseUrl = "https://raw.githubusercontent.com/gravitystorm/openstreetmap-carto/master/symbols/";
    const iconUrl = `${baseUrl}${feature.properties.osm_iconPath}`;
    
    const icon = L.divIcon({
      html: `<div style="
        background-color: white; 
        border: 2px solid #277da1; 
        border-radius: 50%; 
        width: 24px; 
        height: 24px; 
        display: flex; 
        align-items: center; 
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      ">
        <img src="${iconUrl}" style="width: 14px; height: 14px;" onerror="this.style.display='none'">
      </div>`,
      className: 'custom-osm-carto-icon',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    return L.marker(latlng, { icon });
  }

  // 2. Fallback pour vos objets MJSL
  const radius = dataset === "osm_indices" ? 6 : 8;
  return L.circleMarker(latlng, {
    radius,
    color: "#fff",
    weight: 1,
    fillColor: colorForFeature(feature),
    fillOpacity: 0.9,
  });
}

function popupContent(feature) {
  const p = feature.properties || {};
  const title =
    p.nom_lieu ||
    p.type_rupture ||
    p.type_amenite ||
    p.type_ambiance ||
    p.type_seuil ||
    p.type_dispositif ||
    p.osm_label ||
    p.name ||
    p._dataset_label ||
    "Objet MJSL";

  const scoreLine = p._mjsl_score !== null && p._mjsl_score !== undefined
    ? `<p class="popup-meta">Score MJSL: <strong>${p._mjsl_score}</strong> / classe <strong>${p._mjsl_class}</strong></p>`
    : `<p class="popup-meta">Indice OSM a verifier sur terrain.</p>`;

  return `
    <p class="popup-title">${escapeHtml(title)}</p>
    <p class="popup-meta">${escapeHtml(p._dataset_label || p._dataset || "")}</p>
    ${scoreLine}
    <p class="popup-meta">${escapeHtml(p.note_obs || p.mjsl_hint || "")}</p>
  `;
}

function renderDetails(feature) {
  const properties = feature.properties || {};
  const rows = Object.entries(properties)
    .filter(([key, value]) => !key.startsWith("_") && value !== "" && value !== null && value !== undefined)
    .slice(0, 38)
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>`)
    .join("");

  els.details.innerHTML = `
    <h2>Diagnostic</h2>
    <table>${rows || "<tr><td>Aucune propriete lisible.</td></tr>"}</table>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function featureMatchesFilters(feature) {
  const p = feature.properties || {};
  const datasetKey = p._dataset;
  if (!appState.layerVisibility.get(datasetKey)) return false;

  if (datasetKey !== "osm_indices") {
    const featureClass = p._mjsl_class || p.classe_mjsl;
    if (featureClass && !appState.activeClasses.has(featureClass)) return false;
  }

  if (appState.category !== "all" && toNumber(p[appState.category]) !== 1) return false;

  const dims = String(p._dimensions || "").split(",").filter(Boolean);
  if (dims.length && !dims.some((dimension) => appState.activeDimensions.has(dimension))) return false;

  return true;
}

function renderMap() {
  appState.featureLayer.clearLayers();
  let visibleCount = 0;

  for (const dataset of appState.datasets.values()) {
    const features = dataset.geojson.features.filter(featureMatchesFilters);
    visibleCount += features.length;

    L.geoJSON(
      { type: "FeatureCollection", features },
      {
        style: styleFeature,
        pointToLayer,
        onEachFeature: (feature, layer) => {
          layer.bindPopup(popupContent(feature));
          layer.on("click", () => renderDetails(feature));
        },
      },
    ).addTo(appState.featureLayer);
  }

  setStatus(`${visibleCount} objets affiches.`);
}

async function loadMjslData() {
  setStatus("Chargement des couches MJSL...");
  let loaded = 0;

  for (const dataset of DATASETS) {
    try {
      const response = await fetch(dataset.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const geojson = await response.json();
      addDataset(dataset, geojson);
      loaded += 1;
    } catch (error) {
      console.warn(`Impossible de charger ${dataset.url}`, error);
    }
  }

  renderLayerFilters();
  renderMap();

  if (loaded === 0) {
    setStatus("Chargement automatique bloque. Lance le serveur local ou importe les GeoJSON manuellement.");
  } else {
    setStatus(`${loaded} couches MJSL chargees.`);
    fitAllVisible();
  }
}

function addDataset(dataset, geojson) {
  const safeGeojson = {
    type: "FeatureCollection",
    features: (geojson.features || []).map((feature) => enrichFeature(feature, dataset)),
  };

  appState.datasets.set(dataset.key, {
    ...dataset,
    geojson: safeGeojson,
  });

  if (!appState.layerVisibility.has(dataset.key)) {
    appState.layerVisibility.set(dataset.key, true);
  }
}

function fitAllVisible() {
  const allFeatures = [];
  for (const dataset of appState.datasets.values()) {
    // Les indices OSM couvrent toute la bbox : les inclure ferait dezoomer hors du corridor MJSL.
    if (dataset.key === "osm_indices") continue;
    allFeatures.push(...dataset.geojson.features.filter(featureMatchesFilters));
  }
  if (!allFeatures.length) return;

  const layer = L.geoJSON({ type: "FeatureCollection", features: allFeatures });
  const bounds = layer.getBounds();
  // Sans animation : un fit anime peut etre casse par un traitement long et laisser la carte au zoom 0.
  if (bounds.isValid()) map.fitBounds(bounds.pad(0.15), { animate: false });
}

function renderLayerFilters() {
  els.layerFilters.innerHTML = "";
  for (const dataset of appState.datasets.values()) {
    const label = document.createElement("label");
    label.innerHTML = `
      <input type="checkbox" data-layer="${dataset.key}" ${appState.layerVisibility.get(dataset.key) ? "checked" : ""}>
      ${escapeHtml(dataset.label)}
    `;
    els.layerFilters.appendChild(label);
  }

  els.layerFilters.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      appState.layerVisibility.set(input.dataset.layer, input.checked);
      renderMap();
    });
  });
}

function renderDimensionFilters() {
  els.dimensionFilters.innerHTML = DIMENSIONS.map((dimension) => `
    <label>
      <input type="checkbox" data-dimension="${dimension.key}" checked>
      ${dimension.label}
    </label>
  `).join("");

  els.dimensionFilters.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) appState.activeDimensions.add(input.dataset.dimension);
      else appState.activeDimensions.delete(input.dataset.dimension);
      renderMap();
    });
  });
}

function renderClassFilters() {
  els.classFilters.innerHTML = CLASSES.map((className) => `
    <label>
      <input type="checkbox" data-class="${className}" checked>
      ${className}
    </label>
  `).join("");

  els.classFilters.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) appState.activeClasses.add(input.dataset.class);
      else appState.activeClasses.delete(input.dataset.class);
      renderMap();
    });
  });
}

function renderZoomButtons() {
  els.zoomButtons.innerHTML = "";
  for (const zoom of ZOOMS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = zoom.label;
    button.addEventListener("click", () => map.setView(zoom.center, zoom.zoom));
    els.zoomButtons.appendChild(button);
  }
}

function overpassBodyQuery(query) {
  const encodedQuery = encodeURIComponent(
    query.replaceAll('\n', '#')
  ).replaceAll('(', '%28').replaceAll(')', '%29').replaceAll('%20', '+').replaceAll('~', '%7E').replaceAll('%23', '%0D%0A'); //.replaceAll('%25OD', '%');
  console.log("data=" + encodedQuery);
  return "data=" + encodedQuery;
}

const OSM_DATASET = {
  key: "osm_indices",
  label: "Indices OSM",
  dimensions: ["D1", "D2", "D4", "D5", "D6"],
};

// La reponse Overpass pese environ 4 Mo : trop pour localStorage (plafond ~5 Mo)
// et son ecriture synchrone bloquait le rendu de la carte. On passe par IndexedDB.
const OSM_CACHE_DB = "mjsl";
const OSM_CACHE_STORE = "osm";
const OSM_CACHE_ID = "overpass_v1";
const OSM_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function openOsmDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OSM_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OSM_CACHE_STORE)) db.createObjectStore(OSM_CACHE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Overpass est un service benevole qui limite et bloque les clients trop bavards.
// On ne l'interroge donc qu'une fois par semaine, ou sur demande via le bouton.
async function readOsmCache() {
  try {
    const db = await openOsmDb();
    const cache = await new Promise((resolve, reject) => {
      const request = db.transaction(OSM_CACHE_STORE, "readonly").objectStore(OSM_CACHE_STORE).get(OSM_CACHE_ID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!cache || !Array.isArray(cache.geojson?.features) || !cache.timestamp) return null;
    return cache;
  } catch (error) {
    console.warn("Cache OSM illisible, il sera reconstruit.", error);
    return null;
  }
}

async function writeOsmCache(geojson) {
  try {
    const db = await openOsmDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(OSM_CACHE_STORE, "readwrite");
      transaction.objectStore(OSM_CACHE_STORE).put({ timestamp: Date.now(), geojson }, OSM_CACHE_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch (error) {
    // Stockage indisponible ou quota depasse : on continue sans cache.
    console.warn("Cache OSM non enregistre.", error);
  }
}

function cacheAgeLabel(timestamp) {
  const days = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

function applyOsmGeojson(geojson) {
  addDataset(OSM_DATASET, geojson);
  renderLayerFilters();
  renderMap();
}

async function loadOsmData({ forceRefresh = false } = {}) {
  const cache = await readOsmCache();

  if (!forceRefresh && cache && Date.now() - cache.timestamp < OSM_CACHE_TTL_MS) {
    applyOsmGeojson(cache.geojson);
    setStatus(`${cache.geojson.features.length} indices OSM (cache du ${cacheAgeLabel(cache.timestamp)}).`);
    return;
  }

  setStatus("Requete OSM/Overpass en cours...");
  const [south, west] = MARSEILLE_BOUNDS[0];
  const [north, east] = MARSEILLE_BOUNDS[1];
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:30];

(
  node["amenity"~"^(bench|toilets|drinking_water|restaurant|cafe|bar|fast_food)$"](${bbox});
  way["amenity"~"^(bench|toilets|drinking_water|restaurant|cafe|bar|fast_food)$"](${bbox});

  node["highway"~"^(steps|crossing|bus_stop)$"](${bbox});
  way["highway"~"^(steps|footway|path|pedestrian|crossing)$"](${bbox});

  node["public_transport"~"^(platform|stop_position)$"](${bbox});
  way["public_transport"~"^(platform)$"](${bbox});

  node["tourism"~"^(viewpoint|information)$"](${bbox});
  way["tourism"~"^(viewpoint|information)$"](${bbox});
);

out body geom;`;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      "headers": {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "fr-FR,fr;q=0.6",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
        "pragma": "no-cache",
      },
      "body": overpassBodyQuery(query),
      "mode": "cors",
      "credentials": "omit",
      "method": "POST",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const osmJson = await response.json();
    const geojson = osmToGeojson(osmJson);
    await writeOsmCache(geojson);
    applyOsmGeojson(geojson);
    setStatus(`${geojson.features.length} indices OSM charges depuis Overpass.`);
  } catch (error) {
    console.error(error);
    if (cache) {
      // Overpass indisponible ou en limitation : le cache, meme perime, vaut mieux qu'une carte vide.
      applyOsmGeojson(cache.geojson);
      setStatus(`Overpass indisponible. ${cache.geojson.features.length} indices OSM affiches depuis le cache (${cacheAgeLabel(cache.timestamp)}).`);
    } else {
      setStatus("Impossible de charger OSM. Verifie internet ou reessaie plus tard.");
    }
  }
}

function osmToGeojson(osmJson) {
  const features = [];

  for (const element of osmJson.elements || []) {
    const tags = element.tags || {};
    const geometry = osmElementGeometry(element);
    if (!geometry) continue;

    const kind = osmKind(tags);
    features.push({
      type: "Feature",
      properties: {
        osm_id: `${element.type}/${element.id}`,
        osm_label: tags.name || kind.label,
        osm_kind: kind.key,
        osm_iconPath: kind.iconPath, // Chemin SVG (peut être null)
        osm_icon: kind.icon,         // Émoji de repli
        mjsl_hint: kind.hint,
        _dataset: "osm_indices",
        _dataset_label: "Indices OSM",
        _dimensions: kind.dimensions.join(","),
        ...tags,
      },
      geometry,
    });
  }

  return { type: "FeatureCollection", features };
}

function osmElementGeometry(element) {
  if (element.type === "node" && element.lat && element.lon) {
    return { type: "Point", coordinates: [element.lon, element.lat] };
  }

  if (element.type === "way" && Array.isArray(element.geometry) && element.geometry.length > 1) {
    const coordinates = element.geometry.map((point) => [point.lon, point.lat]);
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const closed = first[0] === last[0] && first[1] === last[1];
    return closed
      ? { type: "Polygon", coordinates: [coordinates] }
      : { type: "LineString", coordinates };
  }

  return null;
}

function osmKind(tags) {
  // Transports publics (bus, tram, arrêts)
  if (tags.highway === "bus_stop" || ["platform", "stop_position"].includes(tags.public_transport)) {
    return { key: "transport", label: "Transport public OSM", dimensions: ["D6"], hint: "Indice de chaîne métropolitaine.", iconPath: "highway/bus_stop.svg" };
  }

  // Cheminements et voirie (highway)
  if (tags.highway === "steps") {
    return { key: "steps", label: "Escalier OSM", dimensions: ["D1"], hint: "Indice de rupture physique à vérifier.", iconPath: "highway/elevator.svg" }; 
  }
  if (tags.highway === "crossing") {
    return { key: "crossing", label: "Traversée OSM", dimensions: ["D1", "D3"], hint: "Point de continuité ou de conflit à vérifier.", iconPath: "highway/traffic_light.svg" };
  }
  if (["footway", "path", "pedestrian"].includes(tags.highway)) {
    return { key: "pedestrian", label: "Cheminement piéton OSM", dimensions: ["D1", "D2", "D4"], hint: "Espace piétonnier potentiellement agréable.", iconPath: "tourism/guidepost.svg" };
  }

  // Équipements et confort (amenity)
  if (tags.amenity === "bench") {
    return { key: "bench", label: "Banc OSM", dimensions: ["D1", "D4"], hint: "Ressource de repos à vérifier.", iconPath: "amenity/bench.svg" };
  }
  if (tags.amenity === "toilets") {
    return { key: "toilets", label: "Toilettes OSM", dimensions: ["D4"], hint: "Ressource de soin et d'hygiène.", iconPath: "amenity/toilets.svg" };
  }
  if (tags.amenity === "drinking_water") {
    return { key: "drinking_water", label: "Point d'eau OSM", dimensions: ["D4"], hint: "Ressource gratuite de confort.", iconPath: "amenity/drinking_water.svg" };
  }
  if (["restaurant", "cafe", "bar", "fast_food"].includes(tags.amenity)) {
    return { key: "commercial", label: "Activité commerciale OSM", dimensions: ["D4", "D5"], hint: "Indice de confort potentiellement conditionné à la consommation.", iconPath: `amenity/${tags.amenity}.svg` };
  }

  // Tourisme et Informations (tourism)
  if (tags.tourism === "viewpoint") {
    return { key: "viewpoint", label: "Belvédère OSM", dimensions: ["D1", "D2", "D4"], hint: "Expérience paysagère et belvédère.", iconPath: "tourism/viewpoint.svg" };
  }
  if (tags.tourism === "information") {
    // Correction du 404 : utilisation de board.svg
    return { key: "information", label: "Information OSM", dimensions: ["D3"], hint: "Point d'information cognitif.", iconPath: "tourism/guidepost.svg" };
  }

  // Fallback global
  return { key: "other", label: "Objet OSM", dimensions: ["D1"], hint: "Indice OSM à confirmer sur terrain.", iconPath: "tourism/terminal.svg" };
}


async function handleFileImport(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  for (const file of files) {
    const text = await file.text();
    const lowerName = file.name.toLowerCase();

    try {
      const geojson = lowerName.endsWith(".csv")
        ? csvToGeojson(text)
        : JSON.parse(text);
      const key = `import_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      addDataset(
        {
          key,
          label: `Import - ${file.name}`,
          dimensions: ["D1", "D2", "D3", "D4", "D5", "D6"],
        },
        geojson,
      );
    } catch (error) {
      console.error(error);
      setStatus(`Import impossible pour ${file.name}.`);
    }
  }

  renderLayerFilters();
  renderMap();
  setStatus(`${files.length} fichier(s) importe(s).`);
}

function csvToGeojson(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { type: "FeatureCollection", features: [] };

  const headers = rows[0].map((header) => header.trim());
  const features = rows.slice(1).map((row) => {
    const props = {};
    headers.forEach((header, index) => {
      props[header] = row[index] ?? "";
    });

    const lat = toNumber(props.lat ?? props.latitude ?? props.coord_y ?? props.y);
    const lon = toNumber(props.lon ?? props.lng ?? props.longitude ?? props.coord_x ?? props.x);
    if (lat === null || lon === null) return null;

    return {
      type: "Feature",
      properties: props,
      geometry: { type: "Point", coordinates: [lon, lat] },
    };
  }).filter(Boolean);

  return { type: "FeatureCollection", features };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function exportGeojson() {
  const features = [];
  for (const dataset of appState.datasets.values()) {
    features.push(...dataset.geojson.features.filter(featureMatchesFilters));
  }

  const blob = new Blob([
    JSON.stringify({ type: "FeatureCollection", name: "mjsl_export_interactif", features }, null, 2),
  ], { type: "application/geo+json" });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mjsl_export_interactif.geojson";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStatus(`${features.length} objets exportes en GeoJSON.`);
}

function initEvents() {
  els.loadMjslBtn.addEventListener("click", loadMjslData);
  els.loadOsmBtn.addEventListener("click", () => loadOsmData({ forceRefresh: true }));
  els.fileInput.addEventListener("change", handleFileImport);
  els.exportBtn.addEventListener("click", exportGeojson);
  els.categoryFilter.addEventListener("change", () => {
    appState.category = els.categoryFilter.value;
    renderMap();
  });
}

function init() {
  renderZoomButtons();
  renderDimensionFilters();
  renderClassFilters();
  initEvents();
  loadMjslData();
  loadOsmData();
}

init();
