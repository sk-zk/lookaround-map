import { vectorBlueLineLayer, rasterBlueLineLayer, historicalBlueLineLayer, historicalRasterBlueLineLayer } from "./layers/coverageLayer.js";
import { diffingCoverageLayer } from "./layers/diffingCoverageLayer.js";
import { AppleTileLayer, AppleMapsLayerType, Emphasis } from "./layers/appleMaps.js";
import { GoogleRoadLayer, googleStreetView } from "./layers/googleMaps.js";
import { openStreetMap, cartoDarkMatter, cartoPositron, cartoVoyager } from "./layers/openStreetMap.js";
import { lookAroundCoverage } from "./layers/lookAroundCoverage.js";
import { Constants } from "./Constants.js";
import { wrapLon } from "../geo/geo.js";
import { DataLang, Theme } from "../enums.js";
import { getUserLocale } from "../util/misc.js";
import { GeolocationButton } from "./ui/GeolocationButton.js";
import { CoverageColorer } from "./layers/colors.js";
import { settings } from "../settings.js";
import { ColorLegendControl } from "../ui/ColorLegendControl.js";
import { ExtendedSearchControl } from "./ui/ExtendedSearchControl.js";
import { FilterControl } from "../ui/FilterControl.js";
import { HistoricalControl } from "../ui/HistoricalControl.js";
import TileDebug from "./layers/TileDebug.js";

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
import TileLayer from "ol/layer/Tile.js";
import { Point } from "ol/geom.js";
import { Select } from "ol/interaction.js"
import { pointerMove, click } from "ol/events/condition.js";

import LayerSwitcher from "../external/ol-layerswitcher/ol-layerswitcher.js";
import ContextMenu from "ol-contextmenu";

class MapManager {
  mapClicked = () => {};

  #map;

  #filterControl;
  #historicalControl;
  #coverageColorer;
  #legendControl;

  #appleRoad;
  #appleRoadDark;
  #appleSatelliteImage;
  #appleSatelliteOverlay;
  #appleSatellite;
  #googleRoadLayer;
  #baseLayers;

  #coverageOverlaysGroup;
  #overlays;

  #markerFeature;
  #markerHoverInteraction;
  #markerDeleteInteraction;
  #ignoreClick;

  constructor(config, onAppleMapsLinkPasted) {
    useGeographic();

    this.#coverageColorer = new CoverageColorer();
    this.#setUpFilterControl();
    this.#setUpHistoricalControl();

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

    this.#legendControl = new ColorLegendControl(this.#coverageColorer);

    this.#createAttributionControl();
    this.#createLayerSwitcher();
    this.#createSearch(onAppleMapsLinkPasted);
    this.#createContextMenu();
    this.#createPanoMarkerLayer();
    this.#createGeolocationButton();

    document.addEventListener("settingChanged", (e) => {
      if (e.setting[0] === "labelsOnTop") { 
        this.#updateLabelZIndex(e.setting[1]); 
      }
      else if (e.setting[0] == "useMuted") {
        this.#updateEmphasis(e.setting[1]);
      }
      else if (e.setting[0] == "showTileModifiedDate") {
        lookAroundCoverage.getLayers().forEach((l) => l.getSource().refresh());
      }
      else if (e.setting[0] == "dataLang") {
        let lang = e.setting[1];
        if (lang === DataLang.Default) {
          lang = getUserLocale();
        }

        const layers = this.#baseLayers.getLayers();
        layers.forEach((l) => {
          if (l.setLanguage) {
            l.setLanguage(lang);
          }
        });
      }
    });

    this.#map.on("click", async (e) => {
      if (this.#ignoreClick) return;
      this.mapClicked(e.coordinate[1], wrapLon(e.coordinate[0]));
    });
  }

  getMap() {
    return this.#map;
  } 

  #setUpBaseLayers() {
    let lang = settings.get("dataLang");
    if (lang === DataLang.Default) {
      lang = getUserLocale();
    }

    this.#appleRoad = new AppleTileLayer({
      title: "Apple Maps Road",
      layerType: AppleMapsLayerType.Road,
      lang: lang,
    });
    this.#appleRoad.set("settingsName", "appleRoad");
    this.#appleRoadDark = new AppleTileLayer({
      title: "Apple Maps Road (Dark)",
      layerType: AppleMapsLayerType.RoadDark,
      lang: lang,
    });
    this.#appleRoadDark.set("settingsName", "appleRoadDark");
    this.#updateEmphasis(settings.get("useMuted"));
  
    this.#appleSatelliteImage = new AppleTileLayer({
      layerType: AppleMapsLayerType.Satellite,
    });
    this.#appleSatelliteOverlay = new AppleTileLayer({
      layerType: AppleMapsLayerType.SatelliteOverlay,
      lang: lang,
    });
    this.#appleSatellite = new LayerGroup({
      title: "Apple Maps Satellite",
      type: "base",
      combine: true,
      visible: false,
      layers: [this.#appleSatelliteImage, this.#appleSatelliteOverlay],
    });
    this.#appleSatellite.setLanguage = (lang) => {
      this.#appleSatelliteOverlay.setLanguage(lang);
    }
    this.#appleSatellite.set("settingsName", "appleSatellite");

    this.#googleRoadLayer = new GoogleRoadLayer("Google Maps Road", lang);
    this.#googleRoadLayer.set("settingsName", "googleRoad");
  
    openStreetMap.set("settingsName", "openStreetMap");
    cartoVoyager.set("settingsName", "cartoVoyager");
    cartoPositron.set("settingsName", "cartoPositron");
    cartoDarkMatter.set("settingsName", "cartoDarkMatter");

    const noBaseLayer = new TileLayer({
      type: "base",
      title: "None",
      visible: false,
    });
    noBaseLayer.set("settingsName", "nothing");

    this.#baseLayers = new LayerGroup({
      title: "Base layer",
      layers: [
        this.#appleRoad, this.#appleRoadDark, this.#appleSatellite, 
        this.#googleRoadLayer, openStreetMap, cartoVoyager, cartoPositron, cartoDarkMatter,
        noBaseLayer
      ],
    });

    const lastBaseLayer = settings.get("lastBaseLayer");
    if (lastBaseLayer) {
      this.#baseLayers.getLayers().forEach((layer, index, array) => {
        layer.setVisible(layer.get("settingsName") === lastBaseLayer);
      });
    } else {
      if (isDarkThemeEnabled()) {
        this.#appleRoad.setVisible(false);
        this.#appleRoadDark.setVisible(true);
      } else {
        this.#appleRoad.setVisible(true);
        this.#appleRoadDark.setVisible(false);
      }
   }

    this.#updateLabelZIndex(settings.get("labelsOnTop"));
  }

  #setUpOverlays() {
    this.#coverageOverlaysGroup = new LayerGroup({
      visible: true,
      title: `
      Look Around: Cached blue lines<br>
      <span class="layer-explanation">
        <a class='layer-link' href='https://gist.github.com/sk-zk/53dfc36fa70dae7f4848ce812002fd16' target='_blank'>(what is this?)</a>
      </span>
      `,
      combine: "true",
      layers: [rasterBlueLineLayer, vectorBlueLineLayer, historicalBlueLineLayer, historicalRasterBlueLineLayer, diffingCoverageLayer],
    });
    this.#updateActiveCachedBlueLineLayer();

    const tileDebugLayer = new TileLayer({
      source: new TileDebug(),
      title: "Debug: Tile coordinates",
      visible: false,
      zIndex: Constants.LABELS_ZINDEX+10,
    });

    this.#overlays = new LayerGroup({
      title: "Overlays",
      layers: [lookAroundCoverage, this.#coverageOverlaysGroup, googleStreetView, tileDebugLayer]
    });
  }

  #createLayerSwitcher() {
    const layerSwitcher = new LayerSwitcher({
      reverse: false,
      groupSelectStyle: "group",
      startActive: true,
    });

    LayerSwitcher.forEachRecursive(this.#map, (layer, index, array) => {
      layer.on("change:visible", (e) => {
          layer = e.target;
          if (layer.get("type") == "base" && layer.getVisible()) {
            settings.set("lastBaseLayer", layer.get("settingsName"));
          }
      });
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
    const geolocationButton = new GeolocationButton(this);
    this.#map.addControl(geolocationButton);
  }

  #createSearch(onAppleMapsLinkPasted) {
    const searchControl = new ExtendedSearchControl({}, onAppleMapsLinkPasted);
    searchControl.addEventListener("select", (e) => {
      const view = this.#map.getView();
      try {
        if (e.search.class == "point" || e.search.osm_type == "node") {
          this.setMarkerPosition([e.search.lon, e.search.lat]);
          this.setIsMarkerDeletable(true);
          view.setCenter([e.search.lon, e.search.lat]);
          view.setZoom(17);
        } else {
          const bounds = e.search.boundingbox;
          const minY = Math.min(bounds[0], bounds[1]);
          const maxY = Math.max(bounds[0], bounds[1]);
          const minX = Math.min(bounds[2], bounds[3]);
          const maxX = Math.max(bounds[2], bounds[3]);
          const extent = [minX, minY, maxX, maxY];
          view.fit(extent);
        }
      } catch (error) {
        console.error(error);
        view.setCenter([e.search.lon, e.search.lat]);
        view.setZoom(17);
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

  #updateEmphasis(useMuted) {
    const emphasis = useMuted ? Emphasis.Muted : Emphasis.Standard;
    this.#appleRoad.getSource().setEmphasis(emphasis);
    this.#appleRoadDark.getSource().setEmphasis(emphasis);
  }

  #setUpFilterControl() {
    this.#filterControl = new FilterControl();
    const settings = this.#filterControl.getFilterSettings();
    vectorBlueLineLayer.setFilterSettings(settings);
    vectorBlueLineLayer.setCoverageColorer(this.#coverageColorer);
    lookAroundCoverage.setFilterSettings(settings);
    lookAroundCoverage.setCoverageColorer(this.#coverageColorer);
    historicalBlueLineLayer.setFilterSettings(settings);
    historicalBlueLineLayer.setCoverageColorer(this.#coverageColorer);
    this.#filterControl.filtersChanged = (f) => this.#onFiltersChanged(f);
  }

  #setUpHistoricalControl() {
    this.#historicalControl = new HistoricalControl();
    diffingCoverageLayer.setHistoricalSettings(this.#historicalControl.getSettings());
    this.#historicalControl.settingsChanged = (settings) => {
      historicalBlueLineLayer.setHistoricalSettings(settings);
      historicalRasterBlueLineLayer.setHistoricalSettings(settings);
      diffingCoverageLayer.setHistoricalSettings(settings);
      this.#updateActiveCachedBlueLineLayer();
    };
  }

  #onFiltersChanged(filterSettings) {
    this.#coverageColorer.filterSettingsChanged(filterSettings);

    this.#updateActiveCachedBlueLineLayer();

    vectorBlueLineLayer.setFilterSettings(filterSettings);
    lookAroundCoverage.setFilterSettings(filterSettings);
    rasterBlueLineLayer.setFilterSettings(filterSettings);
    rasterBlueLineLayer.changed();
    historicalBlueLineLayer.setFilterSettings(filterSettings);
    diffingCoverageLayer.setFilterSettings(filterSettings);

    this.#legendControl.updateLegend(filterSettings);
  }

  #updateActiveCachedBlueLineLayer() {
    // TODO refactor this

    const filterSettings = this.#filterControl.getFilterSettings();
    const historicalSettings = this.#historicalControl.getSettings();

    if (historicalSettings.enabled) {
      rasterBlueLineLayer.setVisible(false);
      vectorBlueLineLayer.setVisible(false);
      lookAroundCoverage.setVisible(false);
      if (historicalSettings.diffingEnabled) {
        diffingCoverageLayer.setVisible(true);
        historicalBlueLineLayer.setVisible(false);
        historicalRasterBlueLineLayer.setVisible(false);
      } else {
        diffingCoverageLayer.setVisible(false);
        historicalBlueLineLayer.setVisible(true);
        if (filterSettings.canUseRasterTiles()) {
          historicalRasterBlueLineLayer.setVisible(true);
          historicalBlueLineLayer.setMinZoom(Constants.VECTOR_TRANSITION_LEVEL-1);
        } else {
          historicalRasterBlueLineLayer.setVisible(false);
          historicalBlueLineLayer.setMinZoom(Constants.MIN_ZOOM-1);
        }
      }
    } else {
      diffingCoverageLayer.setVisible(false);
      historicalBlueLineLayer.setVisible(false);
      historicalRasterBlueLineLayer.setVisible(false);
      vectorBlueLineLayer.setVisible(true);
      lookAroundCoverage.setVisible(true);
      if (filterSettings.canUseRasterTiles()) {
        rasterBlueLineLayer.setVisible(true);
        vectorBlueLineLayer.setMinZoom(Constants.VECTOR_TRANSITION_LEVEL-1);
      } else {
        rasterBlueLineLayer.setVisible(false);
        vectorBlueLineLayer.setMinZoom(Constants.MIN_ZOOM-1);
      }
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
          classname: "ctx-center",
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
            const center = this.#map.getView().getCenter();
            const extent = this.#map.getView().calculateExtent(this.#map.getSize());
            const lonSpan = (extent[2] - extent[0]);
            const latSpan = (extent[3] - extent[1]);
            window.open(
              `https://maps.apple.com/frame?center=${center[1]},${center[0]}&span=${latSpan},${lonSpan}`,
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

    const hoverStyle = new Style({
      image: new Icon({
        anchor: [0.5, 1],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "/static/marker-icon-remove.png",
      }),
    });
  
    this.#markerFeature = new Feature({
      geometry: null,
    });
    this.#markerFeature.setStyle(markerStyle);
  
    const mapMarkerSource = new VectorSource({
      features: [this.#markerFeature],
    });
  
    const mapMarkerLayer = new VectorLayer({
      source: mapMarkerSource,
      zIndex: Constants.MARKERS_ZINDEX,
    });
    mapMarkerLayer.set("name", "panoMarker");
  
    this.#map.addLayer(mapMarkerLayer);

    this.#markerHoverInteraction = new Select({
      condition: pointerMove,
      style: hoverStyle,
      layers: [mapMarkerLayer],
    });
    this.#markerHoverInteraction.on("select", (e) => {
      this.#ignoreClick = (e.selected.length > 0);
    });

    this.#markerDeleteInteraction = new Select({
      condition: click,
      layers: [mapMarkerLayer],
      style: markerStyle,
    });
    this.#markerDeleteInteraction.on("select", (e) => {
      this.#markerDeleteInteraction.clearSelection();
      this.setMarkerPosition(null);
      this.#ignoreClick = false;
    });

    this.#map.addInteraction(this.#markerHoverInteraction);
    this.#map.addInteraction(this.#markerDeleteInteraction);
  }

  setMarkerPosition(coordinate) {
    if (coordinate) {
      this.#markerFeature.setGeometry(new Point(coordinate));
    } else {
      this.#markerFeature.setGeometry(null);
    }
  }

  setIsMarkerDeletable(deletable) {
    this.#markerHoverInteraction.setActive(deletable);
    this.#markerDeleteInteraction.setActive(deletable);
    if (!deletable) {
      this.#ignoreClick = false;
    }
  }
}

function isDarkThemeEnabled() {
  return (
    settings.get("theme") === Theme.Dark ||
    (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

export { MapManager };
