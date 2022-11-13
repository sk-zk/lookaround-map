import { Api } from "../../Api.js";
import { LRUMap } from "../../external/js_lru/lru.js";
import { wgs84ToTileCoord } from "../../util/geo.js";

// cache coverage tiles locally to stop leaflet from re-requesting everything
// every time the zoom level changes.
const coverageTileCache = new LRUMap(2**12);

const api = new Api();

L.GridLayer.Coverage = L.GridLayer.extend({
  createTile: function (coords, done) {
    const tile = document.createElement("canvas");
    const tileSize = this.getTileSize();
    tile.setAttribute("width", tileSize.x);
    tile.setAttribute("height", tileSize.y);

    const ctx = tile.getContext("2d");

    if (coverageTileCache.has(`${coords.x},${coords.y}`)) {
      const panos = coverageTileCache.get(`${coords.x},${coords.y}`);
      drawPanos(panos, coords, tileSize, ctx);
      // apparently I can't call done directly?
      setTimeout(function () {
        done(null, tile);
      }, 0);
    } else {
      api.getCoverageTile(coords.x, coords.y)
        .then((panos) => {
          coverageTileCache.set(`${coords.x},${coords.y}`, panos);
          drawPanos(panos, coords, tileSize, ctx);
          done(null, tile);
        });
    }
    return tile;
  },
});

L.gridLayer.coverage = function (opts) {
  return new L.GridLayer.Coverage(opts);
};

function drawPanos(panos, coords, tileSize, ctx) {
  for (const pano of panos) {
    if (pano.coverageType === 3) {
      ctx.fillStyle = "rgba(173, 140, 191, 0.2)";
      ctx.strokeStyle = "rgba(173, 140, 191, 0.8)";
    } else {
      ctx.fillStyle = "rgba(0, 150, 170, 0.2)";
      ctx.strokeStyle = "rgba(0, 150, 170, 0.8)";
    }
    ctx.lineWidth = 2;
    const tileCoord = wgs84ToTileCoord(pano.lat, pano.lon, 17);
    const xOffset = (tileCoord.x - coords.x) * tileSize.x - 1;
    const yOffset = (tileCoord.y - coords.y) * tileSize.y - 1;
    ctx.beginPath();
    ctx.arc(xOffset, yOffset, coords.z - 13.5, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.stroke();
  }
}
