// Modified from the original at
// https://github.com/openlayers/openlayers/blob/v10.10.0/src/ol/source/TileDebug.js
// BSD 2-Clause License

import { createCanvasContext2D } from "ol/dom.js";
import EventType from "ol/events/EventType.js";
import { get as getProjection } from "ol/proj.js";
import { toSize } from "ol/size.js";
import { renderXYZTemplate } from "ol/uri.js";
import DataTileSource from "ol/source/DataTile.js";
import ImageTileSource from "ol/source/ImageTile.js";

/**
 * @typedef {Object} Options
 * @property {import("../proj.js").ProjectionLike} [projection='EPSG:3857'] Optional projection.
 * @property {import("../tilegrid/TileGrid.js").default} [tileGrid] Tile grid.
 * @property {boolean} [wrapX=true] Whether to wrap the world horizontally.
 * @property {number|import("../array.js").NearestDirectionFunction} [zDirection=0]
 * Set to `1` when debugging `VectorTile` sources with a default configuration.
 * Choose whether to use tiles with a higher or lower zoom level when between integer
 * zoom levels. See {@link module:ol/tilegrid/TileGrid~TileGrid#getZForResolution}.
 * @property {import("./Tile.js").default} [source] Tile source.
 * This allows `projection`, `tileGrid`, `wrapX` and `zDirection` to be copied from another source.
 * If both `source` and individual options are specified the individual options will have precedence.
 * @property {string} [template='z:{z} x:{x} y:{y}'] Template for labeling the tiles.
 * Should include `{x}`, `{y}` or `{-y}`, and `{z}` placeholders.
 */

/**
 * @classdesc
 * A pseudo tile source, which does not fetch tiles from a server, but renders
 * a grid outline for the tile grid/projection along with the coordinates for
 * each tile.
 * @api
 */
class TileDebug extends ImageTileSource {
  /**
   * @param {Options} [options] Debug tile options.
   */
  constructor(options) {
    /**
     * @type {Options}
     */
    options = options || {};
    const template = options.template || "{z}/{x}/{y}";
    const source = options.source;

    super({
      transition: 0,
      wrapX:
        options.wrapX !== undefined
          ? options.wrapX
          : source !== undefined
            ? source.getWrapX()
            : undefined,
    });

    const setReady = () => {
      this.projection =
        options.projection !== undefined
          ? getProjection(options.projection)
          : source !== undefined
            ? source.getProjection()
            : this.projection;
      this.tileGrid =
        options.tileGrid !== undefined
          ? options.tileGrid
          : source !== undefined
            ? source.getTileGrid()
            : this.tileGrid;
      this.zDirection =
        options.zDirection !== undefined
          ? options.zDirection
          : source !== undefined
            ? source.zDirection
            : this.zDirection;

      if (source instanceof DataTileSource) {
        this.transformMatrix = source.transformMatrix?.slice() || null;
      }

      const tileGrid = this.tileGrid;
      if (tileGrid) {
        this.setTileSizes(
          tileGrid
            .getResolutions()
            .map((r, i) =>
              toSize(tileGrid.getTileSize(i)).map((s) =>
                Math.max(Math.floor(s), 1),
              ),
            ),
        );
      }

      this.setLoader((z, x, y, loaderOptions) => {
        const [width, height] = this.getTileSize(z);
        const ctx = createCanvasContext2D(width, height);

        const textCenterX = width * 0.5;
        const textTopY = height * 0.5;

        const fontSize = 18;
        ctx.font = `bold ${fontSize}px Inter`;
    
        const text = renderXYZTemplate(template, z, x, y, loaderOptions.maxY);
        const textMetrics = ctx.measureText(text);
        const actualHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
        const padding = 3;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillRect(
          textCenterX - textMetrics.width / 2 - padding,
          textTopY - padding,
          textMetrics.width + padding * 2,
          actualHeight + padding * 2
        );
    
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(0,0,200,0.8)";
        ctx.fillText(text, textCenterX, textTopY);

        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, width + 0.5, height + 0.5);

        // make the loader aysnc, so it behaves like other sources that fetch data from a remote server
        return Promise.resolve(ctx.canvas);
      });
      this.setState("ready");
    };

    if (source === undefined || source.getState() === "ready") {
      setReady();
    } else {
      const handler = () => {
        if (source.getState() === "ready") {
          source.removeEventListener(EventType.CHANGE, handler);
          setReady();
        }
      };
      source.addEventListener(EventType.CHANGE, handler);
    }
  }
}

export default TileDebug;