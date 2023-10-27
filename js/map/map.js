import { vectorBlueLineLayer, rasterBlueLineLayer } from "./layers/cachedBlueLines.js";
import { AppleTileLayer, AppleMapsLayerType } from "./layers/appleMaps.js";
import { GoogleRoadLayer, googleStreetView } from "./layers/googleMaps.js";
import { openStreetMap, cartoDarkMatter, cartoPositron, cartoVoyager } from "./layers/openStreetMap.js";
import { lookaroundCoverage } from "./layers/lookaroundCoverage.js";
import { Constants } from "./Constants.js";
import { wrapLon } from "../geo/geo.js";
import { Theme } from "../enums.js";
import { getUserLocale } from "../util/misc.js";
import { GeolocationButton } from "./GeolocationButton.js";
import { CoverageColorer } from "./layers/colors.js";

import { useGeographic } from "ol/proj.js";
import LayerGroup from "ol/layer/Group.js";
import Map from "ol/Map.js";
import View from "ol/View.js";
import { Attribution, defaults as controlDefaults } from "ol/control.js";
import Style from "ol/style/Style.js";
import Icon from "ol/style/Icon.js";
import Feature from "ol/Feature.js";
import VectorSource from "ol/source/Vector.js";
import VectorLayer from "ol/layer/Vector.js";

import LayerSwitcher from "../external/ol-layerswitcher/ol-layerswitcher.js";
import ContextMenu from "ol-contextmenu";
import SearchNominatim from "ol-ext/control/SearchNominatim.js";

class MapManager {
  #map;

  #filterControl;
  #coverageColorer;
  #languageTag;

  #appleRoad;
  #appleRoadDark;
  #appleSatelliteImage;
  #appleSatelliteOverlay;
  #appleSatellite;
  #googleRoadLayer;
  #baseLayers;

  #cachedBlueLines;
  #overlays;

  constructor(config, filterControl) {
    this.#filterControl = filterControl;

    useGeographic();

    this.#languageTag = getUserLocale();
    this.#setUpBaseLayers();
    this.#setUpOverlays();
  
    this.#map = new Map({
      layers: [this.#baseLayers, this.#overlays],
      target: "map",
      view: new View({
        center: [config.center.longitude, config.center.latitude],
        zoom: config.center.zoom,
        minZoom: Constants.MIN_ZOOM,
        maxZoom: Constants.MAX_ZOOM,
        constrainResolution: true,
        enableRotation: false,
      }),
      controls: controlDefaults({
        zoom: true,
        attribution: false,
        rotate: false,
      }),
    });

    this.#createAttributionControl();
    this.#createLayerSwitcher();
    this.#createSearch();
    this.#createContextMenu();
    this.#createPanoMarkerLayer();
    this.#setUpFilterControl();
    this.#createGeolocationButton();
  }

  getMap() {
    return this.#map;
  }
  
  #setUpBaseLayers() {
    this.#appleRoad = new AppleTileLayer({
      title: "Apple Maps Road",
      layerType: AppleMapsLayerType.Road,
      lang: this.#languageTag,
    });
  
    this.#appleRoadDark = new AppleTileLayer({
      title: "Apple Maps Road (Dark)",
      layerType: AppleMapsLayerType.RoadDark,
      lang: this.#languageTag,
    });
  
    this.#appleSatelliteImage = new AppleTileLayer({
      layerType: AppleMapsLayerType.Satellite,
    });
    this.#appleSatelliteOverlay = new AppleTileLayer({
      layerType: AppleMapsLayerType.SatelliteOverlay,
      lang: this.#languageTag,
    });
    this.#appleSatellite = new LayerGroup({
      title: "Apple Maps Satellite",
      type: "base",
      combine: true,
      visible: false,
      layers: [this.#appleSatelliteImage, this.#appleSatelliteOverlay],
    });
  
    if (isDarkThemeEnabled()) {
      this.#appleRoad.setVisible(false);
      this.#appleRoadDark.setVisible(true);
    } else {
      this.#appleRoad.setVisible(true);
      this.#appleRoadDark.setVisible(false);
    }
  
    this.#googleRoadLayer = new GoogleRoadLayer(this.#languageTag);
  
    this.#baseLayers = new LayerGroup({
      title: "Base layer",
      layers: [this.#appleRoad, this.#appleRoadDark, this.#appleSatellite, this.#googleRoadLayer,
        openStreetMap, cartoVoyager, cartoPositron, cartoDarkMatter]
    });
  
    document.addEventListener("labelOrderChanged", (_) => {
      const labelsOnTop = localStorage.getItem("labelsOnTop") !== "false";
      this.#updateLabelZIndex(labelsOnTop);
    });
    this.#updateLabelZIndex(localStorage.getItem("labelsOnTop") !== "false");
  }

  #setUpOverlays() {
    this.#cachedBlueLines = new LayerGroup({
      visible: true,
      title: `
      Apple Look Around cached blue lines<br>
      <span class="layer-explanation">(<a class='layer-link' href='https://gist.github.com/sk-zk/53dfc36fa70dae7f4848ce812002fd16' target='_blank'>what is this?</a>)</span>
      `,
      combine: "true",
      layers: [rasterBlueLineLayer, vectorBlueLineLayer],
    });
    this.#updateActiveCachedBlueLineLayer(true);

    this.#overlays = new LayerGroup({
      title: "Overlays",
      layers: [lookaroundCoverage, this.#cachedBlueLines, googleStreetView]
    });
  }

  #createLayerSwitcher() {
    const layerSwitcher = new LayerSwitcher({
      reverse: false,
      groupSelectStyle: "group",
      startActive: true,
    });
    this.#map.addControl(layerSwitcher);
    document.querySelector("#sidebar-layers-insert").appendChild(layerSwitcher.panel);
  }

  #createAttributionControl() {
    const attributionControl = new Attribution({
      collapsible: false,
      collapsed: false,
    });
    this.#map.addControl(attributionControl);
  }

  #createGeolocationButton() {
    const geolocationButton = new GeolocationButton();
    this.#map.addControl(geolocationButton);
  }

  #createSearch() {
    const searchControl = new SearchNominatim({});
    searchControl.addEventListener("select", (e) => {
      try {
        const bounds = e.search.boundingbox;
        const minY = Math.min(bounds[0], bounds[1]);
        const maxY = Math.max(bounds[0], bounds[1]);
        const minX = Math.min(bounds[2], bounds[3]);
        const maxX = Math.max(bounds[2], bounds[3]);
        const extent = [minX, minY, maxX, maxY];
        this.#map.getView().fit(extent);
      } catch (error) {
        console.error(error);
        this.#map.getView().setCenter([e.search.lon, e.search.lat]);
        this.#map.getView().setZoom(17);
      }
    });
    this.#map.addControl(searchControl);
  }

  #updateLabelZIndex(labelsOnTop) {
    this.#appleSatelliteOverlay.setZIndex(labelsOnTop ? Constants.LABELS_ZINDEX : Constants.LABELS_BELOW_ZINDEX);
    this.#googleRoadLayer.setLabelsOnTop(labelsOnTop);
    cartoPositron.setLabelsOnTop(labelsOnTop);
    cartoDarkMatter.setLabelsOnTop(labelsOnTop);
    cartoVoyager.setLabelsOnTop(labelsOnTop);
  }

  #setUpFilterControl() {
    this.#coverageColorer = new CoverageColorer();
    vectorBlueLineLayer.setFilterSettings(this.#filterControl.getFilterSettings());
    vectorBlueLineLayer.setCoverageColorer(this.#coverageColorer);
    lookaroundCoverage.setFilterSettings(this.#filterControl.getFilterSettings());
    lookaroundCoverage.setCoverageColorer(this.#coverageColorer);
    this.#filterControl.filtersChanged = (filterSettings) => this.#onFiltersChanged(filterSettings);
  }

  #onFiltersChanged(filterSettings) {
    this.#coverageColorer.filterSettingsChanged(filterSettings);
    this.#updateActiveCachedBlueLineLayer(filterSettings.canUseRasterTiles());
    vectorBlueLineLayer.setFilterSettings(filterSettings);
    vectorBlueLineLayer.getLayers().forEach((l) => l.changed());
    lookaroundCoverage.setFilterSettings(filterSettings);
    lookaroundCoverage.getLayers().forEach((l) => l.getSource().refresh());
    rasterBlueLineLayer.setFilterSettings(filterSettings);
    rasterBlueLineLayer.changed();
  }

  #updateActiveCachedBlueLineLayer(useRasterTiles) {
    if (useRasterTiles) {
      rasterBlueLineLayer.setVisible(true);
      vectorBlueLineLayer.setMinZoom(rasterBlueLineLayer.getMaxZoom());
    } else {
      rasterBlueLineLayer.setVisible(false);
      vectorBlueLineLayer.setMinZoom(Constants.MIN_ZOOM-1);
    }
  }

  #createContextMenu() {
    const contextMenu = new ContextMenu({
      width: 250,
      defaultItems: false,
      items: [
        {
          text: "Copy coordinates to clipboard",
          icon: "image:()",
          classname: "ctx-copy",
          callback: (e) => {
            e.coordinate[0] = wrapLon(e.coordinate[0]);
            navigator.clipboard.writeText(`${e.coordinate[1]}, ${e.coordinate[0]}`);
          },
        },
        {
          text: "Center map here",
          icon: "image:()",
          callback: (e) => {
            this.#map.getView().animate({
              duration: 300,
              center: e.coordinate,
            });
          },
        },
        "-",
        {
          text: "Open in Apple Maps",
          icon: "image:()",
          callback: (_) => {
            const view = this.#map.getView();
            const center = view.getCenter();
            const zoom = view.getZoom();
            window.open(
              `http://maps.apple.com/?ll=${center[1]},${center[0]}&z=${zoom}`,
              "_blank"
            );
          },
        },
        {
          text: "Open in Google Maps",
          icon: "image:()",
          callback: (_) => {
            const view = this.#map.getView();
            const center = view.getCenter();
            const zoom = view.getZoom();
            window.open(
              `https://www.google.com/maps/@${center[1]},${center[0]},${zoom}z/data=!5m1!1e5`,
              "_blank"
            );
          },
        },
        {
          text: "Open in OpenStreetMap",
          icon: "image:()",
          callback: (_) => {
            const view = this.#map.getView();
            const center = view.getCenter();
            const zoom = view.getZoom();
            window.open(
              `https://www.openstreetmap.org/#map=${zoom}/${center[1]}/${center[0]}`,
              "_blank"
            );
          },
        },
      ],
    });
    this.#map.addControl(contextMenu);
    this.#map.getViewport().addEventListener("contextmenu", (e) => {
      const clickCoordinates = this.#map.getEventCoordinate(e);
      clickCoordinates[0] = wrapLon(clickCoordinates[0]);
      // looks like this library doesn't support updating menu item text at runtime either
      contextMenu.element.childNodes[0].childNodes[0].innerHTML = 
        `${clickCoordinates[1].toFixed(5)}, ${clickCoordinates[0].toFixed(5)}`;
    });
  }

  #createPanoMarkerLayer() {
    const markerStyle = new Style({
      image: new Icon({
        anchor: [0.5, 1],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "/static/marker-icon.png",
      }),
    });
  
    const markerFeature = new Feature({
      geometry: null,
    });
  
    markerFeature.setStyle(markerStyle);
  
    const mapMarkerSource = new VectorSource({
      features: [markerFeature],
    });
  
    const mapMarkerLayer = new VectorLayer({
      source: mapMarkerSource,
      zIndex: Constants.MARKERS_ZINDEX,
    });
    mapMarkerLayer.set("name", "panoMarker");
  
    this.#map.addLayer(mapMarkerLayer);
  }
}

function isDarkThemeEnabled() {
  return (
    localStorage.getItem("theme") === Theme.Dark ||
    (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

export { MapManager };