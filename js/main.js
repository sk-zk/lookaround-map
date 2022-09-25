import { createMap } from "./map/map.js";
import { createPanoViewer } from "./viewer/viewer.js";
import { Authenticator } from "./util/Authenticator.js";
import { reverseGeocode } from "./util/nominatim.js";

function initMap() {
  map = createMap({
    center: params.center, 
    auth: auth
  });
  map.on("moveend", (e) => {
    updateHashParams();
  });
  map.on("zoomend", (e) => {
    updateHashParams();
  });
  map.on("click", async (e) => {
    const clickCoordinates = e.latlng.wrap();
    await fetchAndDisplayPanoAt(clickCoordinates.lat, clickCoordinates.lng);
  });
}

function parseHashParams() {
  const params = new URLSearchParams(window.location.hash.substring(1));

  let center = null;
  if (params.has("c")) {
      const centerParams = params.get("c").split("/");
      center = { zoom: centerParams[0], latitude: centerParams[1], longitude: centerParams[2] };
  } else {
      center = { zoom: 3, latitude: 20, longitude: 0 };
  }

  let pano = null;
  if (params.has("p")) {
      const panoParams = params.get("p").split("/");
      pano = { latitude: panoParams[0], longitude: panoParams[1] };
  }

  return {
      "center": center,
      "pano": pano
  };
}

function updateHashParams() {
    const center = map.getCenter().wrap();
    const zoom = map.getZoom();
    let newHash = `c=${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
    if (selectedPano) {
      // there's no API call known to me which will return metadata for a
      // specific panoid like there is with streetview. this means that to fetch
      // pano metadata, its location must also be known, so I've decided to use
      // that for permalinks rather than panoids until I have a better solution
      newHash += `&p=${selectedPano.lat.toFixed(5)}/${selectedPano.lon.toFixed(5)}`;
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
    await panoViewer.navigateTo(pano);
  } else {
    initPanoViewer(pano);
    switchMapToPanoLayout(pano);
    hideMapControls();
    document.querySelector("#close-pano").style.display = "flex";
  }
  updateMapMarker(pano);
  await updatePanoInfo(pano);
  updateHashParams();
}

function initPanoViewer(pano) {
  const container = document.querySelector("#pano");
  panoViewer = createPanoViewer({
    container: container,
    initialPano: pano,
  });

  const compass = document.getElementsByClassName("psv-compass")[0];
  // their compass plugin doesn't support directly passing in an absolute position by default,
  // so I gotta resort to this until I get around to modifying it
  compass.style.top = "calc(100vh - 270px - 90px)";

  panoViewer.plugins.movement.on("moved", async (e, pano) => {
    updateMapMarker(pano);
    updatePanoInfo(pano);
    updateHashParams();
  });
}

async function updatePanoInfo(pano) {
  document.querySelector("#pano-info").style.display = "block";
  document.querySelector("#pano-id").innerHTML = `${pano.panoid} / ${pano.region_id}`;
  document.querySelector("#pano-coordinates").innerHTML = `${pano.lat.toFixed(5)}, ${pano.lon.toFixed(5)}`;
  document.querySelector("#pano-date").innerHTML = `${pano.date}`;
  await updatePanoAddress(pano);
}

async function updatePanoAddress(pano) {
  // 2 AM code below
  const countriesWithHouseNrFirst = ["us", "ca", "au", "nz", "ie", "gb", "fr"]
  const address = await reverseGeocode(pano.lat, pano.lon);
  let html = "";

  if (address.house_number) {
    const road = [];
    if (countriesWithHouseNrFirst.includes(address.country_code)) 
    {
      road.push(address.house_number);
      road.push(address.road);
    } 
    else {
      road.push(address.road);
      road.push(address.house_number);
    }
    html += `<strong>${road.join(" ")}</strong><br>`;
  }
  else if (address.road) {
    html += `<strong>${address.road}</strong><br>`;
  }

  const town = [];
  if (address.hamlet) {
    town.push(address.hamlet);
  }
  if (address.village) {
    town.push(address.village);
  }
  if (address.town) {
    town.push(address.town);
  }
  if (address.city) {
    town.push(address.city);
  }
  html += town.join(", ") + "<br>";

  const admin = [];
  if (address.county) {
    admin.push(address.county);
  }
  if (address.state) {
    admin.push(address.state);
  }
  admin.push(address.country);
  html += admin.join(", ");

  html += '<div id="nominatim-attribution">© OpenStreetMap contributors</div><hr>';

  document.querySelector("#pano-address").innerHTML = html;
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

function closePanoViewer() {
  selectedPano = null;
  destroyPanoViewer();

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

function destroyPanoViewer() {
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
    closePanoViewer();
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
document.querySelector("#close-pano").addEventListener("click", (e) => { closePanoViewer(); });

const params = parseHashParams();
if (params.pano) {
  switchMapToPanoLayout();
  initMap();
  await fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude);
}
else {
  initMap();
}
