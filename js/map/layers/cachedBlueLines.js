import { Constants } from "../Constants.js";

const carLinesStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({
    color: "rgba(0, 150, 170, 1)",
    width: 2,
  }),
});
const trekkerLinesStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({
    color: "rgba(173, 140, 191, 1)",
    width: 2,
  }),
});

function styleFeature(feature, resolution, filterSettings) {
  if (
    filterSettings.filterByDate &&
    (feature.get("timestamp") < filterSettings.minDate ||
      feature.get("timestamp") > filterSettings.maxDate)
  ) {
    return null;
  }

  switch (feature.get("coverage_type")) {
    case 2:
      return filterSettings.showCars ? carLinesStyle : null;
    case 3:
      return filterSettings.showTrekkers ? trekkerLinesStyle : null;
    default:
      console.error(
        `Coverage type ${feature.get("coverage_type")} has no style`
      );
      return carLinesStyle;
  }
}

class CachedBlueLinesSource extends ol.source.VectorTile {
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
      format: new ol.format.MVT(),
      //url: "http://localhost:8080/maps/lookaround/{z}/{x}/{y}.vector.pbf",
      url: "https://lookmap.eu.pythonanywhere.com/bluelines/{z}/{x}/{y}",
      tileGrid: ol.tilegrid.createXYZ({
        minZoom: options.minZoom,
        maxZoom: options.maxZoom,
        tileSize: [options.tileSize, options.tileSize],
      }),
      tilePixelRatio: 2,
    });
  }
}

class CachedBlueLinesLayer extends ol.layer.VectorTile {
  #filterSettings = Constants.DEFAULT_FILTERS;
  #currentPolygonFilter = null;

  constructor(options) {
    options = options || {};
    super({
      title: options.title,
      visible: options.visible,
      opacity: 0.7,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      source: new CachedBlueLinesSource({
        minZoom: 0,
        maxZoom: 14,
        tileSize: options.tileSize,
      }),
    });
    super.setStyle((feature, resolution) =>
      styleFeature(feature, resolution, this.#filterSettings)
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

// For now, I've removed the extents and just let the rest 404.
// Might be OK.

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

const blueLineLayer = new ol.layer.Group({
  visible: false,
  title: "Apple Look Around cached blue lines<br><em>(not available for all countries)</em>",
  combine: "true",
  layers: [blueLineLayerMain, blueLineLayer15],
});
blueLineLayer.setFilterSettings = (filterSettings) => {
  blueLineLayerMain.setFilterSettings(filterSettings);
  blueLineLayer15.setFilterSettings(filterSettings);
};

export { blueLineLayer };
