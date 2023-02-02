import { Constants } from "../Constants.js";
import { CoverageType } from "../../enums.js";
import { determineLineColor, carLineColor, trekkerLineColor } from "./colors.js";

import LayerGroup from 'ol/layer/Group.js';
import VectorTile from 'ol/source/VectorTile.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import MVT from 'ol/format/MVT.js';
import { createXYZ } from 'ol/tilegrid';

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


function styleFeature(feature, resolution, filterSettings, map) {
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
  const color = determineLineColor(filterSettings, feature.get("timestamp"), feature.get("coverage_type"));

  switch (feature.get("coverage_type")) {
    case 2:
      carLinesStyle.getStroke().setWidth(width);
      carLinesStyle.getStroke().setColor(color);
      return carLinesStyle;
    case 3:
      trekkerLinesStyle.getStroke().setWidth(width);
      trekkerLinesStyle.getStroke().setColor(color);
      return trekkerLinesStyle;
    default:
      console.error(`Coverage type ${feature.get("coverage_type")} has no style`);
      return carLinesStyle;
  }
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

class CachedBlueLinesSource extends VectorTile {
  constructor(options) {
    options = options || {};
    options.tileSize = options.tileSize || 256;

    super({
      opaque: false,
      projection: options.projection,
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
      zDirection: options.zDirection,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      format: new MVT(),
      tileGrid: createXYZ({
        minZoom: options.minZoom,
        maxZoom: options.maxZoom,
        tileSize: [options.tileSize, options.tileSize],
      }),
      tilePixelRatio: 2,
      //url: "http://localhost:8080/maps/lookaround/{z}/{x}/{y}.vector.pbf",
      url: "https://lookmap.eu.pythonanywhere.com/bluelines2/{z}/{x}/{y}/",
    });
  }
}

class CachedBlueLinesLayer extends VectorTileLayer {
  #filterSettings = Constants.DEFAULT_FILTERS;
  #currentPolygonFilter = null;

  constructor(options) {
    options = options || {};
    super({
      title: options.title,
      visible: options.visible,
      opacity: 0.8,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      source: new CachedBlueLinesSource({
        minZoom: 0,
        maxZoom: 14,
        tileSize: options.tileSize,
      }),
    });
    super.setStyle((feature, resolution) =>
      styleFeature(feature, resolution, this.#filterSettings, this.get("map"))
    );
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

const blueLineLayerMain = new CachedBlueLinesLayer({
  minZoom: 0,
  maxZoom: 14,
});
// my static tiles end at z=14 and the layer that comes directly from apple
// is displayed at z>=16. this is a workaround to stop z=15 from being blurry.
const blueLineLayer15 = new CachedBlueLinesLayer({
  minZoom: 14,
  maxZoom: 15,
});

const blueLineLayer = new LayerGroup({
  visible: false,
  title: `
    Apple Look Around cached blue lines<br>
    <span class="layer-explanation">(<a class='layer-link' href='https://gist.github.com/sk-zk/53dfc36fa70dae7f4848ce812002fd16' target='_blank'>what is this?</a>)</span>
    `,
  combine: "true",
  layers: [blueLineLayerMain, blueLineLayer15],
});
blueLineLayer.setFilterSettings = (filterSettings) => {
  blueLineLayerMain.setFilterSettings(filterSettings);
  blueLineLayer15.setFilterSettings(filterSettings);
};

export { blueLineLayer };
