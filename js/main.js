import { Api } from "./Api.js";
import { Authenticator } from "./util/Authenticator.js";
import { createMap } from "./map/map.js";
import { createPanoViewer } from "./viewer/viewer.js";
import { NominatimReverseGeocoder, AppleReverseGeocoder} from "./util/geocoders.js";
import { wrapLon, RAD2DEG, DEG2RAD } from "./util/geo.js";
import { TimeMachineControl } from "./ui/TimeMachineControl.js";
import { Constants } from "./map/Constants.js";
import { AddressSource, Theme } from "./enums.js";
import { FilterControl } from "./ui/FilterControl.js";
import { SettingsControl } from "./ui/SettingsControl.js";
import { getUserLocale, showNotificationTooltip } from "./util/misc.js";

import Point from "ol/geom/Point.js";
import tinyDebounce from "tiny-debounce";
import { Base64 } from "js-base64";

import "ol/ol.css";
import "ol-ext/dist/ol-ext.css";
import "ol-contextmenu/ol-contextmenu.css";
import "./external/ol-layerswitcher/ol-layerswitcher.css";
import "../static/style.css";

function initMap() {
  map = createMap(
    {
      center: params.center,
      auth: auth,
    },
    new FilterControl()
  );
  map.on("moveend", (_) => {
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

  // share link
  if (params.has("s")) {
    const payload = decodeShareLinkPayload(params.get("s"));
    console.log(payload);
    return {
      center: { zoom: 18, latitude: payload.lat, longitude: payload.lon },
      pano: { latitude: payload.lat, longitude: payload.lon, position: { yaw: payload.yaw, pitch: payload.pitch } },
    };
  }

  // normal link
  let center = null;
  if (params.has("c")) {
    const centerParams = params.get("c").split("/");
    center = {
      zoom: centerParams[0],
      latitude: centerParams[1],
      longitude: centerParams[2],
    };
  } else {
    center = { zoom: Constants.MIN_ZOOM, latitude: 20, longitude: 0 };
  }

  let pano = null;
  if (params.has("p")) {
    const panoParams = params.get("p").split("/");
    pano = { latitude: panoParams[0], longitude: panoParams[1] };
    if (params.has("a")) {
      const position = params.get("a").split("/");
      pano.position = { yaw: position[0] * DEG2RAD, pitch:  position[1] * DEG2RAD };
    }
  }

  return {
    center: center,
    pano: pano,
  };
}

function updateHashParams() {
  const view = map.getView();
  const center = view.getCenter();
  const zoom = view.getZoom();
  let newHash = `c=${zoom}/${center[1].toFixed(6)}/${wrapLon(center[0]).toFixed(6)}`;
  if (currentPano) {
    // there's no API call known to me which will return metadata for a
    // specific panoid like there is with streetview. this means that to fetch
    // pano metadata, its location must also be known, so I've decided to use
    // that for permalinks rather than panoids until I have a better solution
    newHash += `&p=${currentPano.lat.toFixed(6)}/${currentPano.lon.toFixed(6)}`;

    const position = panoViewer.getPosition();
    newHash += `&a=${(position.yaw * RAD2DEG).toFixed(2)}/${(position.pitch * RAD2DEG).toFixed(2)}`
  }
  // instead of setting window.location.hash directly, I set it like this
  // to not trigger a hashchanged event
  history.replaceState(null, null, document.location.pathname + "#" + newHash);
}

async function fetchAndDisplayPanoAt(lat, lon) {
  const zoom = map.getView().getZoom();
  let radius;
  if (zoom > 15) {
    radius = 20;
  } else {
    radius = 100;
  }
  const pano = (await api.getPanosAroundPoint(lat, lon, radius, 1))[0];
  currentPano = pano;
  if (pano) {
    displayPano(pano);
  }
}

async function displayPano(pano) {
  updatePanoInfo(pano).then((_) => updateHashParams());
  if (panoViewer) {
    await panoViewer.navigateTo(pano);
  } else {
    initPanoViewer(pano);
    switchMapToPanoLayout();
  }
  updateMapMarker(pano);
}

function initPanoViewer(pano) {
  const container = document.querySelector("#pano");
  panoViewer = createPanoViewer({
    container: container,
    initialPano: pano,
  });

  panoViewer.plugins.movement.addEventListener("moved", async (e) => {
    onPanoChanged(e);
  });

  panoViewer.alternativeDatesChangedCallback = (dates) => {
    timeMachineControl.setAlternativeDates(dates);
  };

  const positionUpdateHandler = tinyDebounce((_) => {updateHashParams()}, 500, {trailing: true, maxWait: 500});
  panoViewer.addEventListener("position-updated", positionUpdateHandler);

  document.querySelector("#open-in-gsv").addEventListener("click", openInGsv);
}

function onPanoChanged(e) {
  const pano = e.detail;
  currentPano = pano;
  updateMapMarker(pano);
  updatePanoInfo(pano).then((_) => updateHashParams());
}

function closePanoViewer() {
  if (!panoViewer) return;

  currentPano = null;
  destroyPanoViewer();

  document.querySelector("#map").classList.remove("pano-overlay");
  map.updateSize();
  map.getLayers().forEach((layer) => {
    if (layer.get("name") === "panoMarker") {
      layer.getSource().getFeatures()[0].setGeometry(null);
    }
  });

  toggleLayoutControlVisibility(true);

  document.title = appTitle;
}

function destroyPanoViewer() {
  if (!panoViewer) return;
  panoViewer.destroy();
  panoViewer = null;
}

function openInGsv() {
  const angle = panoViewer.getPosition();
  const pan = angle.yaw * RAD2DEG;
  const pitch = angle.pitch * RAD2DEG + 90;
  // estimated, but it works well enough
  const zoom = -0.65 * panoViewer.getZoomLevel() + 77.5;
  window.open(
    `https://www.google.com/maps/@${currentPano.lat},${currentPano.lon},3a,${zoom}y,${pan}h,${pitch}t/data=!3m1!1e1`,
    "_blank"
  );
}

async function updatePanoInfo(pano) {
  document.querySelector(
    "#pano-id"
  ).innerHTML = `${pano.panoid} / ${pano.batchId}`;/* +
  `<br>${pano.dbg[1]} ${pano.dbg[2]}` +
    `<br>Heading: ${pano.heading * RAD2DEG}°` + 
    `<br>Raw elevation: ${pano.rawElevation}`;*/
  const date = new Date(pano.timestamp);
  const locale = getUserLocale();
  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: pano.timezone,
  }).format(date);
  document.querySelector("#pano-date").innerHTML = formattedDate;
  fetchAndSetAddress(pano.lat, pano.lon);
}

async function fetchAndSetAddress(lat, lon) {
  const address = await geocoder.reverseGeocode(lat, lon, getUserLocale());
  if (address.length === 0) {
    document.querySelector("#pano-address-first-line").innerText = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    document.querySelector("#pano-address-rest").innerHTML = "";
    document.title = `${appTitle}`;
  } else {
    document.querySelector("#pano-address-first-line").innerText = address[0];

    let html = address
      .slice(1)
      .filter((x) => x !== "")
      .join("<br>");
    if (geocoder.attributionText) {
      html += `<div id="nominatim-attribution">${geocoder.attributionText}</div>`;
    }
    html += "<hr>";

    document.querySelector("#pano-address-rest").innerHTML = html;
    document.title = `${address[0]} – ${appTitle}`;
  }
}

async function updateMapMarker(pano) {
  map.getLayers().forEach((layer) => {
    if (layer.get("name") === "panoMarker") {
      layer
        .getSource()
        .getFeatures()[0]
        .setGeometry(new Point([pano.lon, pano.lat]));
    }
  });

  map.getView().animate({
    center: [pano.lon, pano.lat],
    duration: 100,
  });
}

function switchMapToPanoLayout() {
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
  document.querySelector("#pano-info").style.display = isMapLayout ? "none" : "block";
  document.querySelector("#sidebar-container").style.display = isMapLayout ? "flex" : "none";
}

function onHashChanged(_) {
  const params = parseHashParams();
  if (params.pano) {
    fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude);
  } else {
    closePanoViewer();
  }
  map.getView().setCenter([params.center.longitude, params.center.latitude]);
  map.getView().setZoom(params.center.zoom);
}

function constructGeocoder() {
  switch (localStorage.getItem("addrSource")) {
    case AddressSource.Nominatim:
      return new NominatimReverseGeocoder();
    default:
    case AddressSource.Apple:
      return new AppleReverseGeocoder();
  }
}

function initSidebar() {
  const sidebar = document.querySelector("#sidebar");
  const sidebarToggle = document.querySelector("#sidebar-toggle");

  sidebarToggle.addEventListener("click", (_) => {
    if (!sidebar.style.display || sidebar.style.display === "none") {
      sidebar.style.display = "block";
      sidebarToggle.innerText = ">";
      sidebarToggle.classList.remove("sidebar-toggle-transparent");
    } else {
      sidebar.style.display = "none";
      sidebarToggle.innerText = "<";
      sidebarToggle.classList.add("sidebar-toggle-transparent");
    }
  });

  createSettingsControl();
}

function createSettingsControl() {
  const settingsControl = new SettingsControl();
  document.addEventListener("addrSourceChanged", (_) => {
    geocoder = constructGeocoder();
  })
  document.addEventListener("themeChanged", (_) => {
    setTheme();
  })
}

function setTheme() {
  switch (localStorage.getItem("theme")) {
    case Theme.Automatic:
    default:
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      }
      break;
    case Theme.Light:
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      break;
    case Theme.Dark:
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      break;
  }
}

function updatePanoInfoVisibility() {
  if (window.matchMedia("only screen and (max-width: 600px)").matches
    || window.matchMedia("only screen and (max-height: 650px)").matches) {
    document.querySelector("#pano-info-details").removeAttribute("open");
  }
  else {
    document.querySelector("#pano-info-details").open = true;
  }
}

function encodeShareLinkPayload(lat, lon, yaw, pitch) {
  const floats = new Float32Array(4);
  floats[0] = lat;
  floats[1] = lon;
  floats[2] = yaw;
  floats[3] = pitch;
  const bytes = new Uint8Array(floats.buffer);
  return Base64.fromUint8Array(bytes, true);
}

function decodeShareLinkPayload(payload) {
  const bytes = Base64.toUint8Array(payload, true);
  const floats = new Float32Array(bytes.buffer);
  return {
    lat: floats[0],
    lon: floats[1],
    yaw: floats[2],
    pitch: floats[3],
  }
}

function writeShareLinkToClipboard() {
  const position = panoViewer.getPosition();
  const payload = encodeShareLinkPayload(currentPano.lat, currentPano.lon, position.yaw, position.pitch);
  const link = `${document.location.protocol}//${document.location.host}${document.location.pathname}#s=${payload}`;
  navigator.clipboard.writeText(link);
}

const appTitle = "Apple Look Around Viewer";
const api = new Api();
const auth = new Authenticator();

let map = null;
let panoViewer = null;
let currentPano = null;

document.title = appTitle;

let geocoder = constructGeocoder();

setTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (_) => {
  setTheme();
});
initSidebar();
updatePanoInfoVisibility();
window.addEventListener("resize", (_) => {
  updatePanoInfoVisibility();
});

window.addEventListener("hashchange", onHashChanged);
document.querySelector("#close-pano").addEventListener("click", (_) => {
  closePanoViewer();
});
document.addEventListener("keydown", async (e) => {
  if (e.code === "Escape") {
    closePanoViewer();
  }
});

const timeMachineControl = new TimeMachineControl();
timeMachineControl.panoSelectedCallback = (pano) => {
  displayPano(pano);
};

document.querySelector("#pano-share").addEventListener("click", (e) => {
  writeShareLinkToClipboard();
  showNotificationTooltip("Copied!", e.clientX, e.clientY, 1500);
});

const params = parseHashParams();
if (params.pano) {
  initMap();
  switchMapToPanoLayout();
  await fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude);
  panoViewer.rotate(params.pano.position);
} else {
  initMap();
}

