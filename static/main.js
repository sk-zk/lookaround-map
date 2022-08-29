import "/static/layers.js";
import { LookaroundAdapter } from "/static/adapter.js";
import { parseHashParams } from "/static/util.js";
import { MovementPlugin } from "/static/movementPlugin.js";
import { Authenticator } from "/static/auth.js";

const LONGITUDE_OFFSET = 1.07992247; // 61.875°, which is the center of face 0
const CAMERA_HEIGHT_METERS = 2.4; // the approximated height of the cameras on the cars that took the coverage

function initMap() {
  let map = L.map("map", {
    center: [params.center.latitude, params.center.longitude],
    minZoom: 3,
    maxZoom: 19,
    zoom: params.center.zoom,
    preferCanvas: true,
    zoomControl: true,
  });

  const appleRoadLightTiles = L.tileLayer.appleMapsTiles(auth, {
    maxZoom: 19,
    type: "road",
    tint: "light",
    keepBuffer: 6,
    attribution: '© Apple',
  }).addTo(map);
  const appleRoadDarkTiles = L.tileLayer.appleMapsTiles(auth, {
    maxZoom: 19,
    type: "road",
    tint: "dark",
    keepBuffer: 6,
    attribution: "© Apple",
  });
  const appleSatelliteTiles = L.layerGroup([
    L.tileLayer.appleMapsTiles(auth, {
      maxZoom: 19,
      type: "satellite",
      keepBuffer: 6,
      attribution: "© Apple",
    }),
    L.tileLayer.appleMapsTiles(auth, {
      maxZoom: 19,
      type: "satellite-overlay",
      keepBuffer: 6,
      attribution: "© Apple",
    }),
  ]);

  const googleRoadTiles = L.tileLayer(
    "https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e0!2ssvv!4m2!1scb_client!2sapiv3!4m2!1scc!2s*211m3*211e2*212b1*213e2!3m3!3sUS!12m1!1e1!4e0",
    {
      maxZoom: 19,
      keepBuffer: 6,
      attribution: "© Google",
    }
  );
  const osmTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    keepBuffer: 6,
    attribution: "© OpenStreetMap"
  });

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
  /*const coverageLayer15 = L.gridLayer.coverage({
    minZoom: 15,
    maxZoom: 15,
    tileSize: 64,
  });*/
  const coverageGroup = L.layerGroup([
    coverageLayerNormal,
    coverageLayer16,
    coverageLayer18,
    coverageLayer19,
  ]).addTo(map);
  
  const baseLayers = {
    "Apple Maps Road (Light)": appleRoadLightTiles,
    "Apple Maps Road (Dark)": appleRoadDarkTiles,
    "Apple Maps Satellite": appleSatelliteTiles,
    "Google Maps Road": googleRoadTiles,
    "OpenStreetMap": osmTiles,
  };
  const overlays = {
    '<div class="multiline-checkbox-label">Look Around coverage<br>(requires z=16 or higher)</div>': coverageGroup,
    "Tile boundaries": debugCoords,
  };
  L.control.layers(baseLayers, overlays).addTo(map);

  map.on("moveend", (e) => {
    updateHashParameters();
  });
  map.on("zoomend", (e) => {
    updateHashParameters();
  });
  map.on("click", async (e) => {
    await fetchAndDisplayPanoAt(e.latlng.lat, e.latlng.lng);
  });

  return map;
}

function updateHashParameters() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    let newHash = `c=${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
    if (selectedPano) {
      // there's no API call known to me which will return metadata for a
      // specific panoid like there is with streetview. this means that to fetch
      // pano metadata, its location must also be known, so I've decided to use
      // that for permalinks rather than panoids until I have a better solution
      newHash += `&p=${selectedPano.lat.toFixed(
        5
      )}/${selectedPano.lon.toFixed(5)}`;
    }
    // instead of setting window.location.hash directly, I set it like this
    // to not trigger a hashchanged event
    history.replaceState(null, null, document.location.pathname + '#' + newHash);
}

async function fetchAndDisplayPanoAt(lat, lon) {
  const response = await fetch(`/closest/${lat}/${lon}/`);
  const pano = await response.json();
  if (pano) {
    displayPano(pano);
  }
}

async function displayPano(pano) {
  if (panoViewer) {
    // for some reason, setPanorama doesn't appear to store the
    // new sphereCorrection anywhere, so I'm just passing it to the
    // viewer adapter manually
    panoViewer.panWorkaround = pano.north + LONGITUDE_OFFSET;
    await panoViewer.setPanorama(`/pano/${pano.panoid}/${pano.region_id}/`, {
      showLoader: false,
      sphereCorrection: {
        pan: pano.north + LONGITUDE_OFFSET,
      }
    });
  } else {
    initPanoViewer(pano);
    switchMapToPanoLayout(pano);
    hideMapControls();
    document.querySelector("#close-pano").style.display = "flex";
  }
  updateMapMarker(pano);
  panoViewer.plugins.movement.updatePanoMarkers(pano);

  updatePanoInfo(pano);
  updateHashParameters();
}

function updatePanoInfo(pano) {
  const panoInfo = document.querySelector("#pano-info");
  panoInfo.style.display = "block";
  panoInfo.innerHTML = `
    <strong>${pano.panoid}</strong>/${pano.region_id}<br>
    <small>${pano.lat.toFixed(5)}, ${pano.lon.toFixed(5)} |
    ${pano.date}</small>
  `;
}

function initPanoViewer(pano) {
  panoViewer = new PhotoSphereViewer.Viewer({
    container: document.querySelector("#pano"),
    adapter: LookaroundAdapter,
    panorama: `/pano/${pano.panoid}/${pano.region_id}/`,
    minFov: 10,
    maxFov: 70,
    defaultLat: 0,
    defaultLong: 0,
    defaultZoomLvl: 10,
    navbar: null,
    sphereCorrection: {
      pan: pano.north + LONGITUDE_OFFSET,
    },
    plugins: [
      [PhotoSphereViewer.CompassPlugin, {
        size: "80px",
      }],
      [PhotoSphereViewer.MarkersPlugin, {}],
      [MovementPlugin, {}]
    ],
  });

  panoViewer.plugins.movement.on("moved", (e, pano) => {
    updateMapMarker(pano);
    updatePanoInfo(pano);
    updateHashParameters();
  });

  const compass = document.getElementsByClassName("psv-compass")[0];
  // their compass plugin doesn't support directly passing in an absolute position by default,
  // so I gotta resort to this until I get around to modifying it
  compass.style.top = "calc(100vh - 270px - 90px)";
}

function updateMapMarker(pano) {
  if (selectedPanoMarker) {
    map.removeLayer(selectedPanoMarker);
  }
  selectedPanoMarker = L.marker(L.latLng(pano.lat, pano.lon)).addTo(map);
  map.setView(L.latLng(pano.lat, pano.lon));
  selectedPano = pano;
}

function switchMapToPanoLayout(pano) {
  document.querySelector("#map").classList.add("pano-overlay");
  if (map) {
    map.invalidateSize();
  }
}

function hideMapControls() {
  document.querySelector(".leaflet-control-zoom").style.display = "none";
  document.querySelector(".leaflet-control-layers").style.display = "none";
}

function closePano() {
  selectedPano = null;
  destroyViewer();

  document.querySelector("#map").classList.remove("pano-overlay");
  map.invalidateSize();  
  if (selectedPanoMarker) {
    map.removeLayer(selectedPanoMarker);
  }
  document.querySelector(".leaflet-control-zoom").style.display = "block";
  document.querySelector(".leaflet-control-layers").style.display = "block";

  document.querySelector("#close-pano").style.display = "none";
  document.querySelector("#pano-info").style.display = "none";
}

function destroyViewer() {
  if (panoViewer) {
    panoViewer.destroy();
    panoViewer = null;
  }
}

function onHashChanged(e) {
  const params = parseHashParams();
  if (params.pano) {
    fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude);
  } else {
    closePano();
  }
  map.setView(L.latLng(params.center.latitude, params.center.longitude));
  map.setZoom(params.center.zoom);
}

const auth = new Authenticator();

let map = null;
let panoViewer = null;
let selectedPano = null;
let selectedPanoMarker = null;

window.addEventListener("hashchange", onHashChanged);
document.querySelector("#close-pano").addEventListener("click", (e) => { closePano(); });

const params = parseHashParams();
if (params.pano) {
  switchMapToPanoLayout();
  map = initMap();
  await fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude);
}
else {
  map = initMap();
}
