import { CoverageType } from "../../enums.js";
import { Api } from "../../Api.js";
import { wgs84ToTileCoord, wrapLon } from "../../util/geo.js";
import { determineLineColor } from "./colors.js";
import { FilterSettings } from "../FilterSettings.js";
import { getDevicePixelRatio } from "../../util/misc.js";

import { rgb } from "d3-color";
import { LRUMap } from "../../external/js_lru/lru.js";

import XYZ from 'ol/source/XYZ.js';
import { createCanvasContext2D } from 'ol/dom.js';
import TileLayer from 'ol/layer/Tile.js';
import LayerGroup from 'ol/layer/Group.js';

const coverageTileCache = new LRUMap(2 ** 12);
const api = new Api();

class LookaroundCoverageSource extends XYZ {
  #filterSettings = new FilterSettings();

  constructor(options) {
    options = options || {};

    const pixelRatio = getDevicePixelRatio();

    super({
      opaque: false,
      projection: options.projection,
      wrapX: true,
      zDirection: options.zDirection,
      url: "z:{z} x:{x} y:{y}",
      minZoom: 17,
      maxZoom: 17,
      tilePixelRatio: pixelRatio,
      tileLoadFunction: async (tile, url) => {
        const tileSize = [options.canvasSize * pixelRatio, options.canvasSize * pixelRatio];
        const ctx = createCanvasContext2D(tileSize[0], tileSize[1]);

        const panos = await this.#getTile(tile);
        this.#drawPanos(panos, tile.tileCoord, tileSize, pixelRatio, ctx);

        tile.setImage(ctx.canvas);
      },
    });
    this.markerSize = options.markerSize;
  }

  async #getTile(tile) {
    const coordKey = `${tile.tileCoord[1]},${tile.tileCoord[2]}`;
    let panos = [];
    if (coverageTileCache.has(coordKey)) {
      panos = coverageTileCache.get(coordKey);
    } else {
      panos = await api.getCoverageTile(tile.tileCoord[1], tile.tileCoord[2]);
      coverageTileCache.set(coordKey, panos);
    }
    return panos;
  }

  #drawPanos(panos, coords, tileSize, pixelRatio, ctx) {
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

      let color = determineLineColor(this.#filterSettings, pano.timestamp, pano.coverageType);
      color = rgb(color);
      color.opacity = 0.2;
      ctx.fillStyle = color.formatRgb();
      color.opacity = 0.8;
      ctx.strokeStyle = color.formatRgb();

      const tileCoord = wgs84ToTileCoord(pano.lat, pano.lon, 17);
      const xOffset = (tileCoord.x - coords[1]) * tileSize[0] - 1;
      const yOffset = (tileCoord.y - coords[2]) * tileSize[1] - 1;
      ctx.beginPath();
      ctx.arc(xOffset, yOffset, this.markerSize * pixelRatio, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.stroke();
    }
  }

  setFilterSettings(filterSettings) {
    this.#filterSettings = filterSettings;
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
const lookaroundCoverage = new LayerGroup({
  title: "Apple Look Around (z>=16)",
  visible: true,
  combine: "true",
  layers: [
    lookaroundCoverage16,
    lookaroundCoverage17,
    lookaroundCoverage18,
    lookaroundCoverage19,
  ],
});
lookaroundCoverage.setFilterSettings = (filterSettings) => {
  lookaroundCoverage16.setFilterSettings(filterSettings);
  lookaroundCoverage17.setFilterSettings(filterSettings);
  lookaroundCoverage18.setFilterSettings(filterSettings);
  lookaroundCoverage19.setFilterSettings(filterSettings);
};

export { lookaroundCoverage };
