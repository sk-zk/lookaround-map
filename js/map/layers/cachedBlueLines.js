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

  constructor(options) {
    options = options || {};
    super({
      title: options.title,
      visible: options.visible,
      opacity: 0.7,
      extent: ol.extent.boundingExtent(options.extent),
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
  }
}

// TODO improve this

const blueLineLayerGermanyMain = new CachedBlueLinesLayer({
  minZoom: 0,
  maxZoom: 14,
  extent: [
    [5.8663153, 47.2701114],
    [15.0419309, 55.099161],
  ],
});
// my static tiles end at z=14 and the layer that comes directly from apple
// is displayed at z>=16. this is a workaround to stop z=15 from being blurry.
const blueLineLayerGermany15 = new CachedBlueLinesLayer({
  minZoom: 14,
  maxZoom: 15,
  extent: [
    [5.8663153, 47.2701114],
    [15.0419309, 55.099161],
  ],
});

const blueLineLayerSingaporeMain = new CachedBlueLinesLayer({
  minZoom: 0,
  maxZoom: 14,
  extent: [
    [103.6056259,1.1586817],
    [104.4096568,1.4715641],
  ],
});
const blueLineLayerSingapore15 = new CachedBlueLinesLayer({
  minZoom: 14,
  maxZoom: 15,
  extent: [
    [103.6056259,1.1586817],
    [104.4096568,1.4715641],
  ],
});

const blueLineLayer = new ol.layer.Group({
  visible: false,
  title: "Apple Look Around cached blue lines<br><em>(Germany and Singapore only)</em>",
  combine: "true",
  layers: [blueLineLayerGermanyMain, blueLineLayerGermany15, blueLineLayerSingaporeMain, blueLineLayerSingapore15],
});
blueLineLayer.setFilterSettings = (filterSettings) => {
  blueLineLayerGermanyMain.setFilterSettings(filterSettings);
  blueLineLayerGermany15.setFilterSettings(filterSettings);
  blueLineLayerSingaporeMain.setFilterSettings(filterSettings);
  blueLineLayerSingapore15.setFilterSettings(filterSettings);
};

export { blueLineLayer };
