import "./layers/debugCoords.js";
import "./layers/appleLookaroundCoverage.js";
import "./layers/appleMaps.js";

const MAX_ZOOM = 19;
const KEEP_BUFFER = 6;

export function createMap(config) {
  let map = L.map("map", {
    center: [config.center.latitude, config.center.longitude],
    minZoom: 3,
    maxZoom: MAX_ZOOM,
    zoom: config.center.zoom,
    preferCanvas: true,
    zoomControl: true,
  });

  const appleRoadLightTiles = L.tileLayer.appleMapsTiles(config.auth, {
    maxZoom: MAX_ZOOM,
    type: "road",
    tint: "light",
    keepBuffer: KEEP_BUFFER,
    attribution: "© Apple",
  }).addTo(map);
  const appleRoadDarkTiles = L.tileLayer.appleMapsTiles(config.auth, {
    maxZoom: MAX_ZOOM,
    type: "road",
    tint: "dark",
    keepBuffer: KEEP_BUFFER,
    attribution: "© Apple",
  });
  const appleSatelliteTiles = L.layerGroup([
    L.tileLayer.appleMapsTiles(config.auth, {
      maxZoom: MAX_ZOOM,
      type: "satellite",
      keepBuffer: KEEP_BUFFER,
      attribution: "© Apple",
    }),
    L.tileLayer.appleMapsTiles(config.auth, {
      maxZoom: MAX_ZOOM,
      type: "satellite-overlay",
      keepBuffer: KEEP_BUFFER,
      attribution: "© Apple",
    }),
  ]);

  const googleRoadTiles = L.tileLayer(
    "https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e0!2ssvv!4m2!1scb_client!2sapiv3!4m2!1scc!2s*211m3*211e2*212b1*213e2!3m3!3sUS!12m1!1e1!4e0",
    {
      maxZoom: MAX_ZOOM,
      keepBuffer: KEEP_BUFFER,
      attribution: "© Google",
    }
  );
  const osmTiles = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: MAX_ZOOM,
      keepBuffer: KEEP_BUFFER,
      attribution: "© OpenStreetMap",
    }
  );

  const debugCoords = L.gridLayer.debugCoords();

  const coverageLayerNormal = L.gridLayer.coverage({
    minZoom: 17,
    maxZoom: 17,
    tileSize: 256,
  });
  const coverageLayer18 = L.gridLayer.coverage({
    minZoom: 18,
    maxZoom: 18,
    tileSize: 512,
  });
  const coverageLayer19 = L.gridLayer.coverage({
    minZoom: 19,
    maxZoom: 19,
    tileSize: 1024,
  });
  const coverageLayer16 = L.gridLayer.coverage({
    minZoom: 16,
    maxZoom: 16,
    tileSize: 128,
  });
  const coverageGroup = L.layerGroup([
    coverageLayer16,
    coverageLayerNormal,
    coverageLayer18,
    coverageLayer19,
  ]).addTo(map);

  const googleStreetViewCoverageTiles = L.tileLayer(
    "https://mts.googleapis.com/vt?hl=en-US&lyrs=svv|cb_client:app&style=5,8&x={x}&y={y}&z={z}",
    {
      maxZoom: MAX_ZOOM,
      className: "gsv-coverage",
      opacity: 0.7,
    }
  );

  const baseLayers = {
    "Apple Maps Road (Light)": appleRoadLightTiles,
    "Apple Maps Road (Dark)": appleRoadDarkTiles,
    "Apple Maps Satellite": appleSatelliteTiles,
    "Google Maps Road": googleRoadTiles,
    "OpenStreetMap": osmTiles,
  };
  const overlays = {
    '<div class="multiline-checkbox-label">Look Around coverage<br>(requires z=16 or higher)</div>': coverageGroup,
    '<div class="multiline-checkbox-label">Google Street View coverage<br>(official only - for comparison)': googleStreetViewCoverageTiles,
    "Tile boundaries": debugCoords,
  };
  L.control.layers(baseLayers, overlays).addTo(map);

  return map;
}
