import "/static/layers.js";
import { LookaroundAdapter } from "/static/adapter.js";
import { parseAnchorParams } from "/static/util.js";
import { Authenticator } from "/static/auth.js";

const LONGITUDE_OFFSET = 1.04 // 60°, which is the center of face 0
const CAMERA_HEIGHT_METERS = 2.4 // the approximated height of the cameras on the cars that took the coverage

function initMap() {
  let map = L.map("map", {
    center: [params.center[1], params.center[2]],
    minZoom: 3,
    maxZoom: 19,
    zoom: params.center[0],
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
  /* too slow
  const coverageLayer15 = L.gridLayer.coverage({
    minZoom: 15,
    maxZoom: 15,
    tileSize: 64,
  }); */
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
    updateUrlParameters();
  });
  map.on("zoomend", (e) => {
    updateUrlParameters();
  });
  
  map.on("click", async (e) => {
    await fetchAndDisplayPanoAt(e.latlng.lat, e.latlng.lng);
  });

  return map;
}

function updateUrlParameters() {
  const center = map.getCenter();
  const zoom = map.getZoom();
  window.location.hash =
    `#c=${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
  if (selectedPano) {
    // there's no API call known to me which will return metadata for a 
    // specific panoid like there is with streetview. this means that to fetch 
    // pano metadata, its location must also be known, so I've decided to use
    // that for permalinks rather than panoids until I have a better solution
    window.location.hash += `&p=${selectedPano.lat.toFixed(5)}/${selectedPano.lon.toFixed(5)}`;
  }
}

async function fetchAndDisplayPanoAt(lat, lon) {
  const response = await fetch(`/closest/${lat}/${lon}/`);
  const pano = await response.json();
  if (pano) {
    if (selectedPanoMarker) {
      map.removeLayer(selectedPanoMarker);
    }
    xDirectionMoved = null;
    yDirectionMoved = null;
    selectedPano = pano;
    selectedPanoMarker = L.marker(L.latLng(pano.lat, pano.lon)).addTo(map);
    //destroyExistingPanoViewer();
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
    panoViewer.off('click'); //remove old click-EventListener
  } else {
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
      ],
    });
    const compass = document.getElementsByClassName("psv-compass")[0];
    // their compass plugin doesn't support directly passing in an absolute position by default,
    // so I gotta resort to this until I get around to modifying it
    compass.style.top = "calc(100vh - 270px - 90px)";
  }

  panoViewer.on('click', async (e, data) => {
    if (data.rightclick) { //ignore right click for moving (preferred only move with left click, but currently with mouse wheel possible)
      return;
    }

    if (data.latitude >= 0.2) { //click was too high in the sky to move
      return;
    }

    //direction-vector of the click where (0,1) is north and (1,0) is east
    let lng_clicked = data.longitude;
    let x = Math.sin(lng_clicked);
    let y = Math.cos(lng_clicked);
    xDirectionMoved = x;
    yDirectionMoved = y;

    //check how far up or down the user clicked and convert it into an approximated distance
    //'approximated' because the height of the apple-camera is not known
    let latitudeClicked = data.latitude;
    if (latitudeClicked >= -0.03) {
      latitudeClicked = -0.03;
    }
    let distanceWanted = Math.cos(latitudeClicked * -1) * CAMERA_HEIGHT_METERS / Math.sin(latitudeClicked * -1)

    let minDiffToDistanceWanted = 10;
    let bestDotProduct = -2.0;
    let distanceFound = 0;
    let newPano;

    //get all the coords on the current tile and on the 8 neighboring tiles
    //neighboring tiles because you could cross tiles while moving
    const response1 = await fetch(`/closestTiles/${pano.lat}/${pano.lon}/`);
    let coords = await response1.json();

    //get the best pano to move to
    //from the coordinates that are in a similar direction like the direction clicked (dot-product),
    //find the coordinate that is the closest to the wanted distance
    for (let i = 0; i < coords.length; i++) {
      let xVec = parseFloat(coords[i].lon) - parseFloat(pano.lon);
      let yVec = parseFloat(coords[i].lat) - parseFloat(pano.lat);

      if (coords[i].panoid === pano.panoid) { //current pano
        continue;
      }

      //distance to current tested coordinate in meters
      let distance = getDistanceInKm(coords[i].lon, coords[i].lat, pano.lon, pano.lat) * 1000;

      //tests similarity between clicked-vector and currentCoord->currentTestedCoord
      let dotProduct = (xVec * x + yVec * y) / (Math.sqrt(x * x + y * y) * Math.sqrt(xVec * xVec + yVec * yVec));

      bestDotProduct = Math.max(dotProduct, bestDotProduct);

      if (Math.abs(distanceWanted - distance) < minDiffToDistanceWanted && dotProduct >= 0.97) {
        minDiffToDistanceWanted = Math.abs(distanceWanted - distance);
        distanceFound = distance;
        newPano = coords[i];
      }
    }

    //show the new pano, if one was found
    if (newPano) {
      selectedPano = newPano;
      if (selectedPanoMarker) {
        map.removeLayer(selectedPanoMarker);
      }
      selectedPanoMarker = L.marker(L.latLng(newPano.lat, newPano.lon)).addTo(map);
      displayPano(newPano);
    }
  })

  switchMapToPanoLayout(pano);
  hideMapControls();

  document.querySelector("#close-pano").style.display = "flex";
  const panoInfo = document.querySelector("#pano-info");
  panoInfo.style.display = "block";
  panoInfo.innerHTML = `
    <strong>${pano.panoid}</strong>/${pano.region_id}<br>
    <small>${pano.lat.toFixed(5)}, ${pano.lon.toFixed(5)} |
    ${pano.date}</small>
  `;
}

function getDistanceInKm(lat1, lon1, lat2, lon2) {
  lon1 = lon1 * (2 * Math.PI) / 360;
  lon2 = lon2 * (2 * Math.PI) / 360;
  lat1 = lat1 * (2 * Math.PI) / 360;
  lat2 = lat2 * (2 * Math.PI) / 360;

  let x = (lon1 - lon2) * Math.cos((lat1 + lat2) / 2.0);
  let y = lat1 - lat2;
  return Math.sqrt(x * x + y * y) * 6371.0;
}

function switchMapToPanoLayout(pano) {
  document.querySelector("#map").classList.add("pano-overlay");
  if (map) {
    map.invalidateSize();
    map.setView(L.latLng(pano.lat, pano.lon));
  }
}

function hideMapControls() {
  document.querySelector(".leaflet-control-zoom").style.display = "none";
  document.querySelector(".leaflet-control-layers").style.display = "none";
}

function destroyViewer() {
  if (panoViewer) {
    panoViewer.destroy();
    panoViewer = null;
  }
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


const auth = new Authenticator();
await auth.init();

let panoViewer = null;
let xDirectionMoved = null;
let yDirectionMoved = null;
let selectedPano = null;
let selectedPanoMarker = null;

document.querySelector("#close-pano").addEventListener("click", (e) => { closePano(); });

const params = parseAnchorParams();

let map = null;
if (params.startPano) {
  switchMapToPanoLayout();
  map = initMap();
  await fetchAndDisplayPanoAt(params.startPano[0], params.startPano[1]);
}
else {
  map = initMap();
}
