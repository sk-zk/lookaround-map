import { Api } from "./Api.js";
import { Authenticator } from "./util/Authenticator.js";
import { MapManager } from "./map/map.js";
import { createPanoViewer } from "./viewer/viewer.js";
import { NominatimReverseGeocoder, AppleReverseGeocoder} from "./geo/geocoders.js";
import { wrapLon, RAD2DEG } from "./geo/geo.js";
import { TimeMachineControl } from "./ui/TimeMachineControl.js";
import { AddressSource, Theme } from "./enums.js";
import { FilterControl } from "./ui/FilterControl.js";
import { SettingsControl } from "./ui/SettingsControl.js";
import { getUserLocale, showNotificationTooltip, isAppleDevice, approxEqual } from "./util/misc.js";
import { parseHashParams, updateHashParams, openInGsv, generateAppleMapsUrl, encodeShareLinkPayload } from "./url.js";

import Point from "ol/geom/Point.js";
import tinyDebounce from "tiny-debounce";

import "ol/ol.css";
import "ol-ext/dist/ol-ext.css";
import "ol-contextmenu/ol-contextmenu.css";
import "./external/ol-layerswitcher/ol-layerswitcher.css";
import "../static/style.css";

function initMap() {
  const mapMgr = new MapManager(
    {
      center: params.center,
      auth: auth,
    },
    new FilterControl()
  );
  map = mapMgr.getMap();
  map.on("moveend", (_) => {
    updateHashParams(map, currentPano, panoViewer?.getPosition());
  });
  map.on("click", async (e) => {
    const clickCoordinates = map.getEventCoordinate(e.originalEvent);
    clickCoordinates[0] = wrapLon(clickCoordinates[0]);
    await fetchAndDisplayPanoAt(clickCoordinates[1], clickCoordinates[0]);
  });
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
    await displayPano(pano);
  }
}

async function displayPano(pano) {
  await updatePanoInfo(pano);
  updateHashParams(map, pano, panoViewer?.getPosition());
  if (panoViewer) {
    await panoViewer.navigateTo(pano);
  } else {
    await initPanoViewer(pano);
    switchMapToPanoLayout();
  }
  updateMapMarker(pano);
}

async function initPanoViewer(pano) {
  const container = document.querySelector("#pano");
  panoViewer = await createPanoViewer({
    container: container,
    initialPano: pano,
  });

  panoViewer.plugins.movement.addEventListener("moved", async (e) => {
    onPanoChanged(e);
  });

  panoViewer.alternativeDatesChangedCallback = (dates) => {
    timeMachineControl.setAlternativeDates(dates);
  };

  const positionUpdateHandler = tinyDebounce(
    (_) => {updateHashParams(map, currentPano, panoViewer.getPosition())}, 
    500, 
    { trailing: true, maxWait: 500 });
  panoViewer.addEventListener("position-updated", positionUpdateHandler);
}

function onPanoChanged(e) {
  const pano = e.detail;
  currentPano = pano;
  updateMapMarker(pano);
  updatePanoInfo(pano).then((_) => updateHashParams(map, pano, panoViewer.getPosition()));
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

function hookUpOpenLinks() {
  document.querySelector("#open-in-gsv").addEventListener("click", (_) => { 
    openInGsv(currentPano.lat, currentPano.lon, panoViewer.getPosition(), panoViewer.getZoomLevel());
  });

  document.querySelector("#open-in-apple-maps").addEventListener("click", (e) => { 
    const url = generateAppleMapsUrl(currentPano.lat, currentPano.lon, currentPano.heading, panoViewer.getPosition());
    if (isRunningOnAppleDevice) {
      window.open(url, "_blank");
    } else {
      showNotificationTooltip("Copied!", e.clientX, e.clientY, 1500)
      navigator.clipboard.writeText(url);
    }
  });
}

async function updatePanoInfo(pano) {
  document.querySelector("#pano-id").innerHTML = `${pano.panoid}`; 
  document.querySelector("#pano-build-id").innerHTML = `${pano.buildId}`; 
  document.querySelector("#pano-pos").innerHTML = `${pano.lat.toFixed(6)}, ${pano.lon.toFixed(6)}`; 
  document.querySelector("#pano-ele").innerHTML = `${pano.elevation.toFixed(2)} m`; 
  /*document.querySelector("#dbg").innerHTML = 
    `h:${pano.heading * RAD2DEG}°` +
    `<br>tX:${pano.tilePos[0]} tY:${pano.tilePos[1]}` + 
    `<br>x:${pano.rawPos[0]} y:${pano.rawPos[1]}` + 
    `<br>Y:${pano.dbg[0]} P:${pano.dbg[1]} R:${pano.dbg[2]}` + 
    `<br>alt:${pano.rawAltitude}`;*/
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

  map.getView().setCenter([params.center.longitude, params.center.latitude]);
  map.getView().setZoom(params.center.zoom);

  if (!params.pano) {
    closePanoViewer();
    return;
  }

  if (approxEqual(params.pano.latitude, currentPano.lat) && 
      approxEqual(params.pano.longitude, currentPano.lon) && 
      params.pano.position) {
    panoViewer.rotate(params.pano.position);
  } else {
    fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude)
    .then(() => {
      if (params.pano.position) {
        panoViewer.rotate(params.pano.position);
      }
    });
  }
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
  if (window.matchMedia("only screen and (max-width: 1000px)").matches
    || window.matchMedia("only screen and (max-height: 650px)").matches) {
    document.querySelector("#pano-info-details").removeAttribute("open");
  }
  else {
    document.querySelector("#pano-info-details").open = true;
  }
}

function writeShareLinkToClipboard() {
  const position = panoViewer.getPosition();
  const payload = encodeShareLinkPayload(currentPano.lat, currentPano.lon, position.yaw, position.pitch);
  const link = `${document.location.protocol}//${document.location.host}${document.location.pathname}#s=${payload}`;
  navigator.clipboard.writeText(link);
}


const appTitle = "Apple Look Around Viewer";
document.title = appTitle;
const api = new Api();
const auth = new Authenticator();
let map = null;
let panoViewer = null;
let currentPano = null;
let geocoder = constructGeocoder();
const isRunningOnAppleDevice = isAppleDevice();

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
hookUpOpenLinks();

const params = parseHashParams();
if (params.pano) {
  initMap();
  switchMapToPanoLayout();
  await fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude);
  panoViewer.rotate(params.pano.position);
} else {
  initMap();
}

