import { Api } from "./Api.js";
import { Authenticator } from "./util/Authenticator.js";
import { MapManager } from "./map/map.js";
import { createPanoViewer } from "./viewer/viewer.js";
import { wrapLon } from "./geo/geo.js";
import { Theme, AdditionalMetadata } from "./enums.js";
import { FilterControl } from "./ui/FilterControl.js";
import { SettingsControl } from "./ui/SettingsControl.js";
import { showNotificationTooltip, isAppleDevice, approxEqual } from "./util/misc.js";
import { parseHashParams, updateHashParams, openInGsv, generateAppleMapsLookAroundUrl, 
  generateAppleMapsWebLookAroundUrl, encodeShareLinkPayload } from "./util/url.js";
import { PanoMetadataBox } from "./ui/PanoMetadataBox.js";
import { settings } from "./settings.js";
import { AddressController } from "./geo/AddressController.js";

import Point from "ol/geom/Point.js";
import tinyDebounce from "tiny-debounce";

import "ol/ol.css";
import "ol-ext/dist/ol-ext.css";
import "ol-contextmenu/ol-contextmenu.css";
import "./external/ol-layerswitcher/ol-layerswitcher.css";
import "../static/style.css";

class Application {
  appTitle = "Apple Look Around Viewer";

  map;
  panoViewer;
  currentPano;
  api;
  auth;
  isRunningOnAppleDevice;

  settingsControl;
  panoMetadataBox;
  addressController;
  address;

  constructor() {
    document.title = this.appTitle;

    this.api = new Api();
    this.auth = new Authenticator();
    this.isRunningOnAppleDevice = isAppleDevice();

    this.panoMetadataBox = new PanoMetadataBox();
    this.panoMetadataBox.panoSelectedCallback = (pano) => {
      this.#displayPano(pano);
    };

    this.#setTheme();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (_) => {
      this.#setTheme();
    });

    this.#initSidebar();
    this.panoMetadataBox.updateVisibility();
    window.addEventListener("resize", (_) => {
      this.panoMetadataBox.updateVisibility();
    });

    window.addEventListener("hashchange", (_) => this.#onHashChanged());
    document.querySelector("#close-pano").addEventListener("click", (_) => {
      this.#closePanoViewer();
    });
    document.addEventListener("keydown", async (e) => {
      if (e.code === "Escape") {
        this.#closePanoViewer();
      }
    });
    
    document.querySelector("#pano-share").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.#writeShareLinkToClipboard();
      showNotificationTooltip("Copied!", e.clientX, e.clientY, 1500);
    }, true);
    this.#hookUpOpenLinks();

    document.querySelector("#pano-screenshot").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.#takeScreenshotOfViewer();
    }, true);

    this.addressController = new AddressController();
    document.addEventListener("addressChanged", (e) => {
      if (e.error) console.log(e.error);

      this.address = e.address;
      this.panoMetadataBox.setAddress(e.address, e.attribution);
      if (e.address) {
        document.title = `${e.address[0]} – ${this.appTitle}`;
      } else {
        document.title = this.appTitle;
      }
    });
  }

  async init() {       
    const params = parseHashParams();
    if (params.pano) {
      this.#initMap(params);
      this.#switchMapToPanoLayout();
      await this.#fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude);
      this.panoViewer.rotate(params.pano.position);
    } else {
      this.#initMap(params);
    }
  }

  #initMap(params) {
    const mapMgr = new MapManager(
      {
        center: params.center,
        auth: this.auth,
      },
      new FilterControl(),
      (params) => { this.#onAppleMapsLinkPasted(params) },
    );
    this.map = mapMgr.getMap();
    this.map.on("moveend", (_) => {
      updateHashParams(this.map, this.currentPano, this.panoViewer?.getPosition());
    });
    this.map.on("click", async (e) => {
      const clickCoordinates = this.map.getEventCoordinate(e.originalEvent);
      clickCoordinates[0] = wrapLon(clickCoordinates[0]);
      await this.#fetchAndDisplayPanoAt(clickCoordinates[1], clickCoordinates[0]);
    });
  }

  #onAppleMapsLinkPasted(params) {
    const view = this.map.getView();  
    if (params.pano) {
      this.#fetchAndDisplayPanoAt(params.pano.lat, params.pano.lon, params.pano.position);
      view.setZoom(17);
    } else {
      if (params.lat && params.lon) {
        view.setCenter([params.lon, params.lat]);
        if (params.zoom) {
          view.setZoom(params.zoom);
        }
        else if (params.span) {
          const minX = params.lon - params.span[1] / 2;
          const maxX = params.lon + params.span[1] / 2;
          const minY = params.lat - params.span[0] / 2;
          const maxY = params.lat + params.span[0] / 2;
          const extent = [minX, minY, maxX, maxY];
          view.fit(extent);
        }
        else {
          view.setZoom(19);
        }
      }
    }
  }

  async #initPanoViewer(pano) {
    const container = document.querySelector("#pano");
    this.panoViewer = await createPanoViewer({
      container: container,
      initialPano: pano,
      initialOrientation: settings.get("initialOrientation"),
      canMoveWithKeyboard: true,
    });
  
    this.panoViewer.plugins.movement.addEventListener("moved", async (e) => {
      this.#onPanoChanged(e);
    });
  
    this.panoViewer.alternativeDatesChangedCallback = (dates) => {
      this.panoMetadataBox.setAlternativeDates(dates);
    };
  
    const positionUpdateHandler = tinyDebounce(
      (_) => {updateHashParams(this.map, this.currentPano, this.panoViewer.getPosition())}, 
      500, 
      { trailing: true, maxWait: 500 }
      );
    this.panoViewer.addEventListener("position-updated", positionUpdateHandler);
  }

  async #fetchAndDisplayPanoAt(lat, lon, position = null) {
    const zoom = this.map.getView().getZoom();
    let radius;
    if (zoom > 15) {
      radius = 20;
    } else {
      radius = 100;
    }
    const pano = (await this.api.getClosestPanos(
      lat, lon, radius, 1, 
      [AdditionalMetadata.CameraMetadata, AdditionalMetadata.Elevation, 
        AdditionalMetadata.Orientation, AdditionalMetadata.TimeZone])
      )[0];
    this.currentPano = pano;
    if (pano) {
      await this.#displayPano(pano, position);
    }
  }

  async #displayPano(pano, position = null) {
    this.panoMetadataBox.setPano(pano);
    this.addressController.fetchAddress(pano.lat, pano.lon);
    updateHashParams(this.map, pano, this.panoViewer?.getPosition());
    if (this.panoViewer) {
      await this.panoViewer.navigateTo(pano);
      if (position) this.panoViewer.rotate(position);
    } else {
      await this.#initPanoViewer(pano);
      if (position) this.panoViewer.rotate(position);
      this.#switchMapToPanoLayout();
    }
    this.#updateMapMarker(pano);
  }

  #onPanoChanged(e) {
    const pano = e.detail;
    this.currentPano = pano;
    this.#updateMapMarker(pano);
    this.panoMetadataBox.setPano(pano);
    this.addressController.fetchAddress(pano.lat, pano.lon);
    updateHashParams(this.map, pano, this.panoViewer.getPosition());
  }

  #closePanoViewer() {
    if (!this.panoViewer) return;
  
    this.currentPano = null;
    this.#destroyPanoViewer();
  
    document.querySelector("#map").classList.remove("pano-overlay");
    this.map.updateSize();
    this.map.getLayers().forEach((layer) => {
      if (layer.get("name") === "panoMarker") {
        layer.getSource().getFeatures()[0].setGeometry(null);
      }
    });
  
    this.#toggleLayoutControlVisibility(true);
  
    document.title = this.appTitle;
  }

  #destroyPanoViewer() {
    if (!this.panoViewer) return;
    this.panoViewer.destroy();
    this.panoViewer = null;
  }

  #hookUpOpenLinks() {
    document.querySelector("#open-in-gsv").addEventListener("click", (_) => { 
      openInGsv(this.currentPano.lat, this.currentPano.lon, this.panoViewer.getPosition(), this.panoViewer.renderer.camera.fov);
    });
  
    document.querySelector("#open-in-apple-maps").addEventListener("click", (e) => { 
      let url;
      if (this.isRunningOnAppleDevice) {
        url = generateAppleMapsLookAroundUrl(this.currentPano.lat, this.currentPano.lon, this.panoViewer.getPosition());
      } else {
        url = generateAppleMapsWebLookAroundUrl(this.currentPano.lat, this.currentPano.lon, this.panoViewer.getPosition());
      }
      window.open(url, "_blank");
    });
  }

  async #updateMapMarker(pano) {
    this.map.getLayers().forEach((layer) => {
      if (layer.get("name") === "panoMarker") {
        layer
          .getSource()
          .getFeatures()[0]
          .setGeometry(new Point([pano.lon, pano.lat]));
      }
    });
  
    this.map.getView().animate({
      center: [pano.lon, pano.lat],
      duration: 100,
    });
  }

  #switchMapToPanoLayout() {
    document.querySelector("#map").classList.add("pano-overlay");
    this.#toggleLayoutControlVisibility(false);
    if (this.map) {
      this.map.updateSize();
    }
  }

  #toggleLayoutControlVisibility(isMapLayout) {
    document.querySelector(".ol-overlaycontainer-stopevent").style.display = isMapLayout ? "block" : "none";
    document.querySelector("#close-pano").style.display = isMapLayout ? "none" : "flex";
    document.querySelector("#pano-info").style.display = isMapLayout ? "none" : "block";
    document.querySelector("#sidebar-container").style.display = isMapLayout ? "flex" : "none";
    document.querySelector("#color-legend").style.visibility = isMapLayout ? "visible" : "hidden";
  }

  #onHashChanged(_) {
    const params = parseHashParams();
  
    this.map.getView().setCenter([params.center.longitude, params.center.latitude]);
    this.map.getView().setZoom(params.center.zoom);
  
    if (!params.pano) {
      this.#closePanoViewer();
      return;
    }
  
    if (this.currentPano && approxEqual(params.pano.latitude, this.currentPano.lat)
                         && approxEqual(params.pano.longitude, this.currentPano.lon)
                         && params.pano.position) {
          this.panoViewer.rotate(params.pano.position);
    } else {
      this.#fetchAndDisplayPanoAt(params.pano.latitude, params.pano.longitude)
      .then(() => {
        if (params.pano.position) {
          this.panoViewer.rotate(params.pano.position);
        }
      });
    }
  }

  #initSidebar() {
    const sidebar = document.querySelector("#sidebar");
    const sidebarToggle = document.querySelector("#sidebar-toggle");
  
    sidebarToggle.addEventListener("click", (_) => {
      if (!sidebar.style.display || sidebar.style.display === "none") {
        sidebar.style.display = "block";
        sidebarToggle.classList.remove("sidebar-toggle-closed");
        sidebarToggle.classList.add("sidebar-toggle-open");
      } else {
        sidebar.style.display = "none";
        sidebarToggle.classList.remove("sidebar-toggle-open");
        sidebarToggle.classList.add("sidebar-toggle-closed");
      }
    });
  
    this.#createSettingsControl();
  }

  #createSettingsControl() {
    this.settingsControl = new SettingsControl();
    document.addEventListener("settingChanged", (e) => {
      if (e.setting[0] === "theme") { this.#setTheme(); }
    })
  }
  
  #setTheme() {
    switch (settings.get("theme")) {
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

  #writeShareLinkToClipboard() {
    const position = this.panoViewer.getPosition();
    const payload = encodeShareLinkPayload(this.currentPano.lat, this.currentPano.lon, position.yaw, position.pitch);
    const link = `${document.location.protocol}//${document.location.host}${document.location.pathname}#s=${payload}`;
    navigator.clipboard.writeText(link);
  }

  #takeScreenshotOfViewer() {
    const screenshot = this.panoViewer.takeScreenshot();
    const a = document.createElement("a");
    a.target = "_blank";
    a.href = screenshot;
    a.download =
      Array.isArray(this.address) && this.address.length !== 0
        ? this.address[0]
        : "panorama";
    a.click();
    a.remove();
  }
} 

const app = new Application();
await app.init();
