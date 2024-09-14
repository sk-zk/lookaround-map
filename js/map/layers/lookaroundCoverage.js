import { CoverageType } from "../../enums.js";
import { Constants } from "../Constants.js";
import { Api } from "../../Api.js";
import { wgs84ToTileCoord } from "../../geo/geo.js";
import { FilterSettings } from "../FilterSettings.js";
import { getDevicePixelRatio } from "../../util/misc.js";
import { LineColorType } from "../../enums.js";
import { getTileModifiedColor } from "./colors.js";
import { settings } from "../../settings.js";

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
      tileLoadFunction: async (mapTile, url) => {
        // `tile.tileCoords` returns unwrapped tile coordinates, but the `url` string
        // has wrapped coordinates inserted into it, which is what we actually want
        const tileCoords = url.split(",");
        const tileSize = [options.canvasSize * pixelRatio, options.canvasSize * pixelRatio];
        const ctx = createCanvasContext2D(tileSize[0], tileSize[1]);

        const tile = await this.#getTile(tileCoords[0], tileCoords[1]);

        if (settings.get("showTileModifiedDate") && tile.panos.length > 0) {
          this.#drawTileModifiedBg(tile.lastModified, tileSize, ctx);
        }

        this.#drawPanos(tile.panos, tileCoords, tileSize, pixelRatio, ctx);

        if (settings.get("showTileModifiedDate") && tile.panos.length > 0) {
          this.#drawLastModifiedText(tile.lastModified, tileSize, ctx);
        }

        mapTile.setImage(ctx.canvas);
      },
    });
    this.markerSize = options.markerSize;
  }

  #drawLastModifiedText(lastModified, tileSize, ctx) {
    const textCenterX = tileSize[0] * 0.5;
    const textTopY = tileSize[1] * 0.8;

    let fontSize;
    if (tileSize[0] <= 128) {
      fontSize = 12;
    }
    else if (tileSize[0] === 256) {
      fontSize = 18;
    }
    else if (tileSize[0] >= 512) {
      fontSize = 24;
    }
    ctx.font = "bold " + fontSize + "px Inter";

    const date = new Date(lastModified * 1000);
    let formattedDate = new Intl.DateTimeFormat("sv-SE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);

    const textMetrics = ctx.measureText(formattedDate);
    const actualHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
    const padding = 3;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(textCenterX - textMetrics.width / 2 - padding,
      textTopY - padding,
      textMetrics.width + padding * 2,
      actualHeight + padding * 2);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillText(formattedDate, textCenterX, textTopY);
  }

  #drawTileModifiedBg(lastModified, tileSize, ctx) {
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, tileSize[0], tileSize[1]);

    let color = rgb(getTileModifiedColor(lastModified));
    color.opacity = 0.15;
    ctx.fillStyle = color.formatRgb();
    ctx.fillRect(0, 0, tileSize[0], tileSize[1]);
  }

  async #getTile(x, y) {
    const cacheKey = `${x},${y}`;
    let tile;
    if (coverageTileCache.has(cacheKey)) {
      tile = coverageTileCache.get(cacheKey);
    } else {
      tile = await api.getCoverageTile(x, y);
      coverageTileCache.set(cacheKey, tile);
    }
    return tile;
  }

  #drawPanos(panos, tileCoords, tileSize, pixelRatio, ctx) {
    ctx.lineWidth = 2 * pixelRatio;

    if (this.#filterSettings.lineColorType === LineColorType.Age) {
      panos.sort((a, b) => a.timestamp - b.timestamp);
    }
    else if (this.#filterSettings.lineColorType === LineColorType.BuildId) {
      panos.sort((a, b) => a.buildId - b.buildId);
    }
    else {
      panos.sort((a, b) => a.coverageType - b.coverageType);
    }

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
      if (this.#filterSettings.filterByBuildId && this.#filterSettings.buildId && 
        pano.buildId !== this.#filterSettings.buildId) {
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
  title: "Apple Look Around (z≥16)",
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
