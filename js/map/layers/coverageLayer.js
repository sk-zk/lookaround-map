import { Constants } from "../Constants.js";
import { CoverageType, LineColorType } from "../../enums.js";
import { carLineColor, trekkerLineColor } from "./colors.js";
import { getDevicePixelRatioAsInt } from "../../util/misc.js";
import { FilterSettings } from "../FilterSettings.js";

import VectorTile from "ol/source/VectorTile.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import Style from "ol/style/Style.js";
import Stroke from "ol/style/Stroke.js";
import MVT from "ol/format/MVT.js";
import XYZ from "ol/source/XYZ.js";
import { createXYZ } from "ol/tilegrid";
import TileLayer from "ol/layer/Tile.js";

const pixelRatio = getDevicePixelRatioAsInt();

const carLinesStyle = new Style({
  stroke: new Stroke({
    color: carLineColor,
    lineCap: "butt",
  }),
});
const trekkerLinesStyle = new Style({
  stroke: new Stroke({
    color: trekkerLineColor,
    lineCap: "butt",
  }),
});

function styleFeature(feature, resolution, filterSettings, map, coverageColorer) {
  if (feature.get("coverage_type") === CoverageType.Car && !filterSettings.showCars) {
    return null;
  }
  if (feature.get("coverage_type") === CoverageType.Trekker && !filterSettings.showTrekkers) {
    return null;
  }
  if (
    filterSettings.filterByDate &&
    (feature.get("timestamp") < filterSettings.minDate ||
      feature.get("timestamp") > filterSettings.maxDate)
  ) {
    return null;
  }

  const zoom = map.getView().getZoomForResolution(resolution);
  const width = determineLineWidth(zoom);
  const color = coverageColorer.determineLineColor({
    timestamp: feature.get("timestamp"), 
    coverageType: feature.get("coverage_type")
  });

  let style;
  switch (feature.get("coverage_type")) {
    case CoverageType.Car:
      style = carLinesStyle;
      break;
    case CoverageType.Trekker:
      style = trekkerLinesStyle;
      break;
    default:
      style = carLinesStyle;
      console.error(`Coverage type ${feature.get("coverage_type")} has no style`);
  }
  style.getStroke().setWidth(width);
  style.getStroke().setColor(color);
  // if color by age is activated, draw newest lines on top.
  // otherwise, draw trekkers on top of car footage
  if (filterSettings.lineColorType === LineColorType.Age) {
    style.setZIndex(parseInt(feature.get("timestamp")));
  }
  else {  
    style.setZIndex(feature.get("coverage_type") === CoverageType.Trekker ? 2 : 1);
  }

  return style;
}

function determineLineWidth(zoom) {
  if (zoom > 13) {
    return 2;
  } else if (zoom > 9) {
    return 1.5;
  } else {
    return 1;
  }
}

class VectorCoverageSource extends VectorTile {
  constructor(options) {
    options = options || {};
    options.tileSize ??= 256;

    super({
      crossOrigin: "anonymous",
      opaque: false,
      projection: options.projection,
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
      zDirection: options.zDirection,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      format: new MVT({
        //featureClass: Feature,
      }),
      tileGrid: createXYZ({
        minZoom: options.minZoom,
        maxZoom: options.maxZoom,
        tileSize: [options.tileSize, options.tileSize],
      }),
      tilePixelRatio: pixelRatio,
      url: "https://boskop.skzk.dev/vector/{z}/{x}/{y}/",
      //url: "http://localhost:8111/lookaround_cache/lookaround/{z}/{x}/{y}",
    });
  }
}

class VectorCoverageLayer extends VectorTileLayer {
  #filterSettings = new FilterSettings();
  #currentPolygonFilter = null;
  #coverageColorer = null;

  constructor(options) {
    options ??= {};
    super({
      crossOrigin: "anonymous",
      title: options.title,
      visible: options.visible,
      opacity: Constants.LINE_OPACITY,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      source: new VectorCoverageSource({
        minZoom: Constants.MIN_ZOOM-1,
        maxZoom: 14,
        tileSize: options.tileSize,
      }),
      zIndex: Constants.BLUE_LINES_ZINDEX,
    });
    super.setStyle((feature, resolution) => styleFeature(feature, resolution, this.#filterSettings, this.get("map"), this.#coverageColorer));
  }

  setFilterSettings(filterSettings) {
    this.#filterSettings = filterSettings;
    this.#setPolygonFilter();
    this.changed();
  }

  #setPolygonFilter() {
    this.removeFilter(this.#currentPolygonFilter);
    this.#currentPolygonFilter = this.#filterSettings.polygonFilter;
    if (this.#currentPolygonFilter != null) {
      this.addFilter(this.#filterSettings.polygonFilter);
    }
  }

  setCoverageColorer(coverageColorer) {
    this.#coverageColorer = coverageColorer;
  }
}

const vectorBlueLineLayer = new VectorCoverageLayer({
  visible: true,
  minZoom: Constants.MIN_ZOOM-1,
  maxZoom: 15,
  title: `Apple Look Around cached blue lines<br>
      <span class="layer-explanation">
        (<a class='layer-link' href='https://gist.github.com/sk-zk/53dfc36fa70dae7f4848ce812002fd16' target='_blank'>what is this?</a>)
      </span>`,
});

class HistoricalVectorCoverageLayer extends VectorCoverageLayer {
  constructor() {
    super({
      visible: false,
    });
    this.setUrl(null);
  }

  setUrl(timestamp) {
    if (!timestamp || !Number.isInteger(timestamp)) {
      timestamp = Math.floor(Date.now() / 1000);
    }
    this.getSource().setUrl(`https://boskop.skzk.dev/vector/{z}/{x}/{y}/?before=${timestamp}`);
  }

  setHistoricalSettings(settings) {
    this.setUrl(Math.floor(settings.dateA / 1000));
  }
}
const historicalBlueLineLayer = new HistoricalVectorCoverageLayer();

class RasterCoverageLayer extends TileLayer {
  #filterSettings = new FilterSettings();
  #currentPolygonFilter;

  constructor() {
    super({
      crossOrigin: "anonymous",
      visible: true,
      type: "overlay",
      source: new XYZ({
        crossOrigin: "anonymous",
        url: `https://boskop.skzk.dev/raster${pixelRatio > 1 ? "_2x" : ""}/{z}/{x}/{y}/`,
        minZoom: Constants.MIN_ZOOM,
        maxZoom: 7,
        tilePixelRatio: Math.min(2, pixelRatio)
      }),
      minZoom: Constants.MIN_ZOOM-1,
      maxZoom: 7,
      opacity: Constants.LINE_OPACITY,
      zIndex: Constants.BLUE_LINES_ZINDEX,
    });
  }

  setFilterSettings(filterSettings) {
    this.#filterSettings = filterSettings;
    this.#setPolygonFilter();
  }

  #setPolygonFilter() {
    this.removeFilter(this.#currentPolygonFilter);
    this.#currentPolygonFilter = this.#filterSettings.polygonFilter;
    if (this.#currentPolygonFilter != null) {
      this.addFilter(this.#filterSettings.polygonFilter);
    }
  } 
}
const rasterBlueLineLayer = new RasterCoverageLayer();

class HistoricalRasterCoverageLayer extends RasterCoverageLayer {
  constructor() {
    super({
      visible: false,
    });
    this.setUrl(null);
  }

  setUrl(timestamp) {
    if (!timestamp || !Number.isInteger(timestamp)) {
      timestamp = Math.floor(Date.now() / 1000);
    }
    this.getSource().setUrl(`https://boskop.skzk.dev/raster${pixelRatio > 1 ? "_2x" : ""}/{z}/{x}/{y}/?before=${timestamp}`);
  }

  setHistoricalSettings(settings) {
    this.setUrl(Math.floor(settings.dateA / 1000));
  }
}
const historicalRasterBlueLineLayer = new HistoricalRasterCoverageLayer();

export { rasterBlueLineLayer, vectorBlueLineLayer, historicalBlueLineLayer, historicalRasterBlueLineLayer };
