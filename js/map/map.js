import { blueLineLayer } from "./layers/cachedBlueLines.js";
import { appleRoad, appleRoadDark, appleSatellite } from "./layers/appleMaps.js";
import { googleRoad, googleStreetView } from "./layers/googleMaps.js";
import { openStreetMap, cartoDbPositron, cartoDbDarkMatter } from "./layers/openStreetMap.js";
import { lookaroundCoverage } from "./layers/lookaroundCoverage.js";
import { Constants } from "./Constants.js";
import { FilterControl } from "./FilterControl.js";
import { wrapLon } from "../util/geo.js";

export function createMap(config) {
  ol.proj.useGeographic();

  const baseLayers = new ol.layer.Group({
    title: "Base layer",
    layers: [appleRoad, appleRoadDark, appleSatellite, googleRoad, 
      openStreetMap, cartoDbPositron, cartoDbDarkMatter]
  });

  const overlays = new ol.layer.Group({
    title: "Overlays",
    layers: [lookaroundCoverage, blueLineLayer, googleStreetView]
  });

  const map = new ol.Map({
    layers: [baseLayers, overlays],
    target: "map",
    view: new ol.View({
      center: [config.center.longitude, config.center.latitude],
      zoom: config.center.zoom,
      minZoom: 2,
      maxZoom: Constants.MAX_ZOOM,
      constrainResolution: true,
      enableRotation: false,
    }),
    controls: ol.control.defaults.defaults({
      zoom: true,
      attribution: false,
      rotate: false,
    }),
  });

  const layerSwitcher = new LayerSwitcher({
    reverse: false,
    groupSelectStyle: 'group'
  });
  map.addControl(layerSwitcher);

  const attributionControl = new ol.control.Attribution({
    collapsible: false,
    collapsed: false,
  });
  map.addControl(attributionControl);

  createContextMenu(map);
  createFilterControl(map);
  createPanoMarkerLayer(map);

  return map;
}

function createFilterControl(map) {
  const filterControl = new FilterControl();
  blueLineLayer.setFilterSettings(filterControl.getFilterSettings());
  lookaroundCoverage.setFilterSettings(filterControl.getFilterSettings());
  filterControl.on("changed", (e) => {
    blueLineLayer.setFilterSettings(e.filterSettings);
    blueLineLayer.getLayers().forEach(l => l.changed());
    lookaroundCoverage.setFilterSettings(e.filterSettings);
    lookaroundCoverage.getLayers().forEach(l => l.getSource().refresh());
  });
  map.addControl(filterControl);
}

function createContextMenu(map) {
  const contextMenu = new ContextMenu({
    width: 250,
    defaultItems: false,
    items: [
      {
        text: "Copy coordinates to clipboard",
        icon: "/static/icons/copy.png",
        callback: (e) => {
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
        callback: (e) => {
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
        callback: (e) => {
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
        callback: (e) => {
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
  const markerStyle = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
      src: '/static/marker-icon.png',
    }),
  });

  const markerFeature = new ol.Feature({
    geometry: null,
  });

  markerFeature.setStyle(markerStyle);

  const mapMarkerSource = new ol.source.Vector({
    features: [markerFeature],
  });

  const mapMarkerLayer = new ol.layer.Vector({
    source: mapMarkerSource,
  });
  mapMarkerLayer.set('name', 'panoMarker');

  map.addLayer(mapMarkerLayer);
}
