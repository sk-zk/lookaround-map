import { vectorBlueLineLayer, rasterBlueLineLayer } from "./layers/cachedBlueLines.js";
import { AppleTileLayer, AppleMapsLayerType } from "./layers/appleMaps.js";
import { GoogleRoadLayer, googleStreetView } from "./layers/googleMaps.js";
import { openStreetMap, cartoDarkMatter, cartoPositron, cartoVoyager } from "./layers/openStreetMap.js";
import { lookaroundCoverage } from "./layers/lookaroundCoverage.js";
import { Constants } from "./Constants.js";
import { wrapLon } from "../geo/geo.js";
import { LineColorType, Theme } from "../enums.js";
import { getUserLocale } from "../util/misc.js";
import { GeolocationButton } from "./GeolocationButton.js";

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

export function createMap(config, filterControl) {
  useGeographic();

  const languageTag = getUserLocale();

  const baseLayers = setUpBaseLayers(languageTag);

  const cachedBlueLines = new LayerGroup({
    visible: true,
    title: `
    Apple Look Around cached blue lines<br>
    <span class="layer-explanation">(<a class='layer-link' href='https://gist.github.com/sk-zk/53dfc36fa70dae7f4848ce812002fd16' target='_blank'>what is this?</a>)</span>
    `,
    combine: "true",
    layers: [rasterBlueLineLayer, vectorBlueLineLayer],
  });

  updateActiveCachedBlueLineLayer(true);

  const overlays = new LayerGroup({
    title: "Overlays",
    layers: [lookaroundCoverage, cachedBlueLines, googleStreetView]
  });

  const map = new Map({
    layers: [baseLayers, overlays],
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

  const layerSwitcher = new LayerSwitcher({
    reverse: false,
    groupSelectStyle: "group",
    startActive: true,
  });
  map.addControl(layerSwitcher);
  document.querySelector("#sidebar-layers-insert").appendChild(layerSwitcher.panel);

  const attributionControl = new Attribution({
    collapsible: false,
    collapsed: false,
  });
  map.addControl(attributionControl);

  setUpSearch(map);
  setUpFilterControl(map, filterControl);
  createContextMenu(map);
  createPanoMarkerLayer(map);

  const geolocationButton = new GeolocationButton();
  map.addControl(geolocationButton);

  return map;
}

function setUpSearch(map) {
  const searchControl = new SearchNominatim({});
  searchControl.addEventListener("select", (e) => {
    try {
      const bounds = e.search.boundingbox;
      const minY = Math.min(bounds[0], bounds[1]);
      const maxY = Math.max(bounds[0], bounds[1]);
      const minX = Math.min(bounds[2], bounds[3]);
      const maxX = Math.max(bounds[2], bounds[3]);
      const extent = [minX, minY, maxX, maxY];
      map.getView().fit(extent);
    } catch (error) {
      console.error(error);
      map.getView().setCenter([e.search.lon, e.search.lat]);
      map.getView().setZoom(17);
    }
  });
  map.addControl(searchControl);
}

function setUpBaseLayers(languageTag) {
  const appleRoad = new AppleTileLayer({
    title: "Apple Maps Road",
    layerType: AppleMapsLayerType.Road,
    lang: languageTag,
  });

  const appleRoadDark = new AppleTileLayer({
    title: "Apple Maps Road (Dark)",
    layerType: AppleMapsLayerType.RoadDark,
    lang: languageTag,
  });

  const appleSatelliteImage = new AppleTileLayer({
    layerType: AppleMapsLayerType.Satellite,
  });
  const appleSatelliteOverlay = new AppleTileLayer({
    layerType: AppleMapsLayerType.SatelliteOverlay,
    lang: languageTag,
  });
  appleSatelliteOverlay.setZIndex(Constants.LABELS_ZINDEX);
  const appleSatellite = new LayerGroup({
    title: "Apple Maps Satellite",
    type: "base",
    combine: true,
    visible: false,
    layers: [appleSatelliteImage, appleSatelliteOverlay],
  });

  if (isDarkThemeEnabled()) {
    appleRoad.setVisible(false);
    appleRoadDark.setVisible(true);
  } else {
    appleRoad.setVisible(true);
    appleRoadDark.setVisible(false);
  }

  const googleRoadLayer = new GoogleRoadLayer(languageTag);

  const baseLayers = new LayerGroup({
    title: "Base layer",
    layers: [appleRoad, appleRoadDark, appleSatellite, googleRoadLayer,
      openStreetMap, cartoVoyager, cartoPositron, cartoDarkMatter]
  });

  document.addEventListener("labelOrderChanged", (_) => {
    const labelsOnTop = localStorage.getItem("labelsOnTop") !== "false";
    appleSatelliteOverlay.setZIndex(labelsOnTop ? Constants.LABELS_ZINDEX : Constants.LABELS_BELOW_ZINDEX);
    googleRoadLayer.setLabelsOnTop(labelsOnTop);
    cartoPositron.setLabelsOnTop(labelsOnTop);
    cartoDarkMatter.setLabelsOnTop(labelsOnTop);
  })

  return baseLayers;
}

function isDarkThemeEnabled() {
  return (
    localStorage.getItem("theme") === Theme.Dark ||
    (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

function setUpFilterControl(map, filterControl) {
  vectorBlueLineLayer.setFilterSettings(filterControl.getFilterSettings());
  lookaroundCoverage.setFilterSettings(filterControl.getFilterSettings());
  filterControl.filtersChanged = (filterSettings) => {
    const useRasterTiles = filterSettings.isDefault() 
      || (filterSettings.lineColorType === LineColorType.Batch);
    updateActiveCachedBlueLineLayer(useRasterTiles);
    vectorBlueLineLayer.setFilterSettings(filterSettings);
    vectorBlueLineLayer.getLayers().forEach(l => l.changed());
    lookaroundCoverage.setFilterSettings(filterSettings);
    lookaroundCoverage.getLayers().forEach(l => l.getSource().refresh());
  };
}

function updateActiveCachedBlueLineLayer(useRasterTiles) {
  if (useRasterTiles) {
    rasterBlueLineLayer.setVisible(true);
    vectorBlueLineLayer.setMinZoom(rasterBlueLineLayer.getMaxZoom());
  } else {
    rasterBlueLineLayer.setVisible(false);
    vectorBlueLineLayer.setMinZoom(Constants.MIN_ZOOM-1);
  }
}

function createContextMenu(map) {
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
          map.getView().animate({
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
          const view = map.getView();
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
          const view = map.getView();
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
          const view = map.getView();
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
  map.addControl(contextMenu);
  map.getViewport().addEventListener("contextmenu", (e) => {
    const clickCoordinates = map.getEventCoordinate(e);
    clickCoordinates[0] = wrapLon(clickCoordinates[0]);
    // looks like this library doesn't support updating menu item text at runtime either
    contextMenu.element.childNodes[0].childNodes[0].innerHTML = 
      `${clickCoordinates[1].toFixed(5)}, ${clickCoordinates[0].toFixed(5)}`;
  });
}

function createPanoMarkerLayer(map) {
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

  map.addLayer(mapMarkerLayer);
}

