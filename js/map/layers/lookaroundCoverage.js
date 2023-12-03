import { CoverageType } from "../../enums.js";
import { Constants } from "../Constants.js";
import { Api } from "../../Api.js";
import { wgs84ToTileCoord } from "../../geo/geo.js";
import { FilterSettings } from "../FilterSettings.js";
import { getDevicePixelRatio } from "../../util/misc.js";

import { LRUMap } from "../../external/js_lru/lru.js";

import XYZ from "ol/source/XYZ.js";
import { createCanvasContext2D } from "ol/dom.js";
import TileLayer from "ol/layer/Tile.js";
import LayerGroup from "ol/layer/Group.js";
import { rgb } from "d3-color";

const coverageTileCache = new LRUMap(2 ** 12);
const api = new Api();

class LookaroundCoverageSource extends XYZ {
  #filterSettings = new FilterSettings();
  #coverageColorer = null;

  constructor(options) {
    options = options || {};

    const pixelRatio = getDevicePixelRatio();

    super({
      opaque: false,
      projection: options.projection,
      wrapX: true,
      zDirection: options.zDirection,
      url: "{x},{y}",
      minZoom: 17,
      maxZoom: 17,
      tilePixelRatio: pixelRatio,
      tileLoadFunction: async (tile, url) => {
        // `tile.tileCoords` returns unwrapped tile coordinates, but the `url` string
        // has wrapped coordinates inserted into it, which is what we actually want
        const tileCoords = url.split(",");
        const tileSize = [options.canvasSize * pixelRatio, options.canvasSize * pixelRatio];
        const ctx = createCanvasContext2D(tileSize[0], tileSize[1]);

        const panos = await this.#getTile(tileCoords[0], tileCoords[1]);
        this.#drawPanos(panos, tileCoords, tileSize, pixelRatio, ctx);

        tile.setImage(ctx.canvas);
      },
    });
    this.markerSize = options.markerSize;
  }

  async #getTile(x, y) {
    const cacheKey = `${x},${y}`;
    let panos = [];
    if (coverageTileCache.has(cacheKey)) {
      panos = coverageTileCache.get(cacheKey);
    } else {
      panos = await api.getCoverageTile(x, y);
      coverageTileCache.set(cacheKey, panos);
    }
    return panos;
  }

  #drawPanos(panos, tileCoords, tileSize, pixelRatio, ctx) {
    ctx.lineWidth = 2 * pixelRatio;

    for (const pano of panos) {
      if (pano.coverageType === CoverageType.Car && !this.#filterSettings.showCars) continue;
      if (pano.coverageType === CoverageType.Trekker && !this.#filterSettings.showTrekkers) continue;
      if (
        this.#filterSettings.filterByDate &&
        (pano.timestamp < this.#filterSettings.minDate ||
          pano.timestamp > this.#filterSettings.maxDate)
      ) {
        continue;
      }

      let color = rgb(this.#coverageColorer.determineCircleColor(pano));
      color.opacity = 0.2;
      ctx.fillStyle = color.formatRgb();
      color.opacity = 0.8;
      ctx.strokeStyle = color.formatRgb();

      const panoTileCoords = wgs84ToTileCoord(pano.lat, pano.lon, 17);
      const xOffset = (panoTileCoords.x - tileCoords[0]) * tileSize[0] - 1;
      const yOffset = (panoTileCoords.y - tileCoords[1]) * tileSize[1] - 1;
      ctx.beginPath();
      ctx.arc(xOffset, yOffset, this.markerSize * pixelRatio, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.stroke();
    }
  }

  setFilterSettings(filterSettings) {
    this.#filterSettings = filterSettings;
  }

  setCoverageColorer(coverageColorer) {
    this.#coverageColorer = coverageColorer;
  }
}

class LookaroundCoverageLayer extends TileLayer {
  #currentPolygonFilter = null;
  #filterSettings = new FilterSettings();

  constructor(options) {
    options = options || {};

    super({
      source: new LookaroundCoverageSource({
        canvasSize: options.canvasSize,
        markerSize: options.markerSize,
      }),
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      zIndex: Constants.BLUE_LINES_ZINDEX,
    });
  }

  setFilterSettings(filterSettings) {
    this.#filterSettings = filterSettings;
    this.getSource().setFilterSettings(this.#filterSettings);
    this.#setPolygonFilter();
  }

  #setPolygonFilter() {
    this.removeFilter(this.#currentPolygonFilter);
    this.#currentPolygonFilter = this.#filterSettings.polygonFilter;
    if (this.#currentPolygonFilter != null) {
      this.addFilter(this.#filterSettings.polygonFilter);
    }
  } 

  setCoverageColorer(coverageColorer) {
    this.getSource().setCoverageColorer(coverageColorer);
  }
}

// doing it this way to prevent openlayers from scaling
const lookaroundCoverage16 = new LookaroundCoverageLayer({
  canvasSize: 128,
  markerSize: 2.5,
  minZoom: 15,
  maxZoom: 16,
});
const lookaroundCoverage17 = new LookaroundCoverageLayer({
  canvasSize: 256,
  markerSize: 3.5,
  minZoom: 16,
  maxZoom: 17,
});
const lookaroundCoverage18 = new LookaroundCoverageLayer({
  canvasSize: 512,
  markerSize: 4.5,
  minZoom: 17,
  maxZoom: 18,
});
const lookaroundCoverage19 = new LookaroundCoverageLayer({
  canvasSize: 1024,
  markerSize: 5.5,
  minZoom: 18,
  maxZoom: 19,
});
const lookaroundCoverage20 = new LookaroundCoverageLayer({
  canvasSize: 2048,
  markerSize: 6.5,
  minZoom: 19,
  maxZoom: 20,
});
const lookaroundCoverage = new LayerGroup({
  title: "Apple Look Around (z>=16)",
  visible: true,
  combine: "true",
  layers: [
    lookaroundCoverage16,
    lookaroundCoverage17,
    lookaroundCoverage18,
    lookaroundCoverage19,
    lookaroundCoverage20,
  ],
});
lookaroundCoverage.setFilterSettings = (filterSettings) => {
  lookaroundCoverage16.setFilterSettings(filterSettings);
  lookaroundCoverage17.setFilterSettings(filterSettings);
  lookaroundCoverage18.setFilterSettings(filterSettings);
  lookaroundCoverage19.setFilterSettings(filterSettings);
  lookaroundCoverage20.setFilterSettings(filterSettings);
};
lookaroundCoverage.setCoverageColorer = (coverageColorer) => {
  lookaroundCoverage16.setCoverageColorer(coverageColorer);
  lookaroundCoverage17.setCoverageColorer(coverageColorer);
  lookaroundCoverage18.setCoverageColorer(coverageColorer);
  lookaroundCoverage19.setCoverageColorer(coverageColorer);
  lookaroundCoverage20.setCoverageColorer(coverageColorer);
};

export { lookaroundCoverage };
