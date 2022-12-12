import { Constants } from "../Constants.js";

import { Api } from "../../Api.js";
import { LRUMap } from "../../external/js_lru/lru.js";
import { wgs84ToTileCoord } from "../../util/geo.js";

const coverageTileCache = new LRUMap(2 ** 12);
const api = new Api();

class LookaroundCoverageSource extends ol.source.XYZ {
  #filterSettings = Constants.DEFAULT_FILTERS;

  constructor(options) {
    options = options || {};

    super({
      opaque: false,
      projection: options.projection,
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
      zDirection: options.zDirection,
      url: "z:{z} x:{x} y:{y}",
      minZoom: 17,
      maxZoom: 17,
      tileLoadFunction: async (tile, ext) => {
        const tileSize = [options.canvasSize, options.canvasSize];
        const ctx = ol.dom.createCanvasContext2D(tileSize[0], tileSize[1]);

        const panos = await this.#getTile(tile);
        this.#drawPanos(panos, tile.tileCoord, tileSize, ctx);

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

  #drawPanos(panos, coords, tileSize, ctx) {
    for (const pano of panos) {
      if (
        this.#filterSettings.filterByDate &&
        (pano.timestamp < this.#filterSettings.minDate ||
          pano.timestamp > this.#filterSettings.maxDate)
      ) {
        continue;
      }

      if (pano.coverageType === 3) {
        if (!this.#filterSettings.showTrekkers) continue;
        ctx.fillStyle = "rgba(173, 140, 191, 0.2)";
        ctx.strokeStyle = "rgba(173, 140, 191, 0.8)";
      } else {
        if (!this.#filterSettings.showCars) continue;
        ctx.fillStyle = "rgba(0, 150, 170, 0.2)";
        ctx.strokeStyle = "rgba(0, 150, 170, 0.8)";
      }
      ctx.lineWidth = 2;
      const tileCoord = wgs84ToTileCoord(pano.lat, pano.lon, 17);
      const xOffset = (tileCoord.x - coords[1]) * tileSize[0] - 1;
      const yOffset = (tileCoord.y - coords[2]) * tileSize[1] - 1;
      ctx.beginPath();
      ctx.arc(xOffset, yOffset, this.markerSize, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.stroke();
    }
  }

  setFilterSettings(filterSettings) {
    this.#filterSettings = filterSettings;
  }
}

class LookaroundCoverageLayer extends ol.layer.Tile {
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
    this.getSource().setFilterSettings(filterSettings);
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
const lookaroundCoverage = new ol.layer.Group({
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
