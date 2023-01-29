import { Constants } from "../Constants.js";
import { gunzipSync } from "../../../node_modules/fflate/esm/browser.js";

import LayerGroup from 'ol/layer/Group.js';
import VectorTile from 'ol/source/VectorTile.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import MVT from 'ol/format/MVT.js';
import { createXYZ } from 'ol/tilegrid';

const carLinesStyle = new Style({
  stroke: new Stroke({
    color: "rgba(26, 159, 176, 1)",
    lineCap: "butt",
  }),
});
const trekkerLinesStyle = new Style({
  stroke: new Stroke({
    color: "rgba(173, 140, 191, 1)",
    lineCap: "butt",
  }),
});

function styleFeature(feature, resolution, filterSettings, map) {
  const zoom = map.getView().getZoomForResolution(resolution);

  let width;
  if (zoom > 13) {
    width = 2;
  } else if (zoom > 9) {
    width = 1.5;
  } else {
    width = 1;
  }
  carLinesStyle.getStroke().setWidth(width);
  trekkerLinesStyle.getStroke().setWidth(width);

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
      console.error(`Coverage type ${feature.get("coverage_type")} has no style`);
      return carLinesStyle;
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
      // nh = no Content-Type header.
      // the static tiles which tegola generates are gzipped, meaning you need
      // to set the appropriate Content-Type so the browser can deal with it.
      // unfortunately, pythonanyhwere also applies the header to 404s, which means
      // that any request to a non-existing tile causes a content encoding error.
      // to fix this, I've added a second endpoint without Content-Type header
      // and decompress tiles manually in js.
      url: "https://lookmap.eu.pythonanywhere.com/bluelines_nh/{z}/{x}/{y}",
      tileLoadFunction: tileLoadFunction,
    });
  }
}

function tileLoadFunction(tile, url) {
  tile.setLoader((extent, resolution, projection) => {
    fetch(url).then((response) => {
      response
        .arrayBuffer()
        .then((data) => { 
          if (response.ok) {
            setFeatures(data, tile, extent, projection);
          } else {
            tile.setFeatures([]);
          }
        })
        .catch((e) => {
          console.log(e);
          tile.setFeatures([]);
        });
    });
  });
}

function setFeatures(data, tile, extent, projection) {
  const decompressed = gunzipSync(new Uint8Array(data));
  const format = tile.getFormat();
  const features = format.readFeatures(decompressed, {
    extent: extent,
    featureProjection: projection,
  });
  tile.setFeatures(features);
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
