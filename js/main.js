import { Api } from "./Api.js";
import { Authenticator } from "./util/Authenticator.js";
import { createMap } from "./map/map.js";
import { createPanoViewer } from "./viewer/viewer.js";
import { reverseGeocode } from "./util/nominatim.js";
import { wrapLon } from "./util/geo.js";
import { TimeMachineControl } from "./ui/TimeMachineControl.js";
import Point from 'ol/geom/Point.js';

import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';
import 'ol-contextmenu/ol-contextmenu.css';
import "./external/ol-layerswitcher/ol-layerswitcher.css";
import '../static/style.css';

const RAD2DEG = 180 / Math.PI;

function initMap() {
  map = createMap({
    center: params.center, 
    auth: auth
  });
  map.on("moveend", (e) => {
    updateHashParams();
  });
  map.on("click", async (e) => {
    const clickCoordinates = map.getEventCoordinate(e.originalEvent);
    clickCoordinates[0] = wrapLon(clickCoordinates[0]);
    await fetchAndDisplayPanoAt(clickCoordinates[1], clickCoordinates[0]);
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
    const view = map.getView();
    const center = view.getCenter();
    const zoom = view.getZoom();
    let newHash = `c=${zoom}/${center[1].toFixed(5)}/${wrapLon(center[0]).toFixed(5)}`;
    if (currentPano) {
      // there's no API call known to me which will return metadata for a
      // specific panoid like there is with streetview. this means that to fetch
      // pano metadata, its location must also be known, so I've decided to use
      // that for permalinks rather than panoids until I have a better solution
      newHash += `&p=${currentPano.lat.toFixed(5)}/${currentPano.lon.toFixed(5)}`;
    }
    // instead of setting window.location.hash directly, I set it like this
    // to not trigger a hashchanged event
    history.replaceState(null, null, document.location.pathname + '#' + newHash);
}

async function fetchAndDisplayPanoAt(lat, lon) {
  const pano = (await api.getPanosAroundPoint(lat, lon, 25, 1))[0];
  currentPano = pano;
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
    currentPano = pano;
    updateMapMarker(pano);
    updatePanoInfo(pano);
    updateHashParams();
  });

  panoViewer.alternativeDatesChangedCallback = (dates) => {
    timeMachineControl.setAlternativeDates(dates);
  };

  document.querySelector("#open-in-gsv").addEventListener("click", openInGsv);
}

function openInGsv() {
  const angle = panoViewer.getPosition();
  const pan = angle.longitude * RAD2DEG;
  const pitch = (angle.latitude * RAD2DEG) + 90;
  // estimated, but it works well enough
  const zoom = -0.65 * panoViewer.getZoomLevel() + 77.5;
  window.open(
    `https://www.google.com/maps/@${currentPano.lat},${currentPano.lon},3a,${zoom}y,${pan}h,${pitch}t/data=!3m1!1e1`, 
    '_blank'
    );
}

async function updatePanoInfo(pano) {
  document.querySelector("#pano-id").innerHTML = `${pano.panoid} / ${pano.regionId}`;
  const date = new Date(pano.timestamp);
  const locale = navigator.languages[0] ?? "en-GB";
  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: pano.timezone,
  }).format(date);
  document.querySelector("#pano-date").innerHTML = formattedDate;
  const address = await reverseGeocode(pano.lat, pano.lon);
  updatePanoAddressField(address);
  document.title = `${address[0]} – ${appTitle}`;
}

function updatePanoAddressField(address) {
  const address_ = address.slice();
  address_[0] = `<strong>${address_[0]}</strong>`;

  const html = address_.filter(x => x !== "").join("<br>") + 
    '<div id="nominatim-attribution">Address © OpenStreetMap contributors</div><hr>';

  document.querySelector("#pano-address").innerHTML = html;
}

async function updateMapMarker(pano) {
  map.getLayers().forEach((layer) => {
    if (layer.get('name') === 'panoMarker') {
      layer.getSource().getFeatures()[0].setGeometry(new Point([pano.lon, pano.lat]));
    }
  })

  map.getView().animate({
    center: [pano.lon, pano.lat],
    duration: 100,
  });
}

function switchMapToPanoLayout(pano) {
  document.querySelector("#map").classList.add("pano-overlay");
  toggleLayoutControlVisibility(false);
  if (map) {
    map.updateSize();
  }
}

function toggleLayoutControlVisibility(isMapLayout) {
  document.querySelector(".ol-overlaycontainer-stopevent").style.display = isMapLayout ? "block" : "none";
  document.querySelector("#github-link").style.display = isMapLayout ? "block" : "none";
  document.querySelector("#close-pano").style.display = isMapLayout ? "none" : "flex";
  document.querySelector("#pano-info").style.display = isMapLayout ? "none": "block";
}

function closePanoViewer() {
  currentPano = null;
  destroyPanoViewer();

  document.querySelector("#map").classList.remove("pano-overlay");
  map.updateSize();  
  map.getLayers().forEach((layer) => {
    if (layer.get('name') === 'panoMarker') {
      layer.getSource().getFeatures()[0].setGeometry(null);
    }
  })

  toggleLayoutControlVisibility(true);

  document.title = appTitle;
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
  map.getView().setCenter([params.center.longitude, params.center.latitude]);
  map.getView().setZoom(params.center.zoom);
}


const appTitle = "Apple Look Around Viewer";
const api = new Api();
const auth = new Authenticator();

let map = null;
let panoViewer = null;
let currentPano = null;

document.title = appTitle;
window.addEventListener("hashchange", onHashChanged);
document.querySelector("#close-pano").addEventListener("click", (_) => { closePanoViewer(); });

const timeMachineControl = new TimeMachineControl();
timeMachineControl.panoSelectedCallback = (pano) => {
  displayPano(pano);
}

const params = parseHashParams();
if (params.pano) {
  initMap();
  switchMapToPanoLayout();
  await fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude);
}
else {
  initMap();
}
