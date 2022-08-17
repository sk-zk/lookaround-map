const TILE_SIZE = 256.0;

//////

export function wgs84ToTileCoord(lat, lon, zoom) {
  let scale = 1 << zoom;
  let worldCoord = wgs84ToMercator(lat, lon);
  return {
    x: (worldCoord.x * scale) / TILE_SIZE,
    y: (worldCoord.y * scale) / TILE_SIZE,
  };
}

function wgs84ToMercator(lat, lon) {
  let siny = Math.sin((lat * Math.PI) / 180.0);
  siny = Math.min(Math.max(siny, -0.9999), 0.9999);
  return {
    x: TILE_SIZE * (0.5 + lon / 360.0),
    y: TILE_SIZE * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)),
  };
}

////////

L.GridLayer.DebugCoords = L.GridLayer.extend({
  createTile: function (coords) {
    var tile = document.createElement("div");
    tile.innerHTML = [coords.x, coords.y, coords.z].join(", ");
    tile.style.outline = "1px solid red";
    return tile;
  },
});

L.gridLayer.debugCoords = function (opts) {
  return new L.GridLayer.DebugCoords(opts);
};

////////

// cache coverage tiles locally in the most primitive way possible
// to stop leaflet from re-requesting everything every time the zoom level changes.
// TODO write a proper cache that kicks out tiles that haven't been loaded in a while
const coverageTileCache = {};

L.GridLayer.Coverage = L.GridLayer.extend({
  createTile: function (coords, done) {
    const tile = document.createElement("canvas");
    const tileSize = this.getTileSize();
    tile.setAttribute("width", tileSize.x);
    tile.setAttribute("height", tileSize.y);

    const ctx = tile.getContext("2d");
    ctx.fillStyle = "rgba(0, 150, 170, 0.2)";
    ctx.strokeStyle = "rgba(0, 150, 170, 0.8)";
    ctx.lineWidth = 2;

    if (coverageTileCache[[coords.x, coords.y]]) {
      const data = coverageTileCache[[coords.x, coords.y]];
      drawPanos(data, coords, tileSize, ctx);
      // apparently I can't call done directly?
      setTimeout(function () {
        done(null, tile);
      }, 0);
    } else {
      fetch(`/tiles/coverage/${coords.x}/${coords.y}/`)
        .then((response) => response.json())
        .then((data) => {
          coverageTileCache[[coords.x, coords.y]] = data;
          drawPanos(data, coords, tileSize, ctx);
          done(null, tile);
        });
    }
    return tile;
  },
});

L.gridLayer.coverage = function (opts) {
  return new L.GridLayer.Coverage(opts);
};

function drawPanos(data, coords, tileSize, ctx) {
  for (let pano of data) {
    const tileCoord = wgs84ToTileCoord(pano.lat, pano.lon, 17);
    const xOffset = (tileCoord.x - coords.x) * tileSize.x - 1;
    const yOffset = (tileCoord.y - coords.y) * tileSize.y - 1;
    ctx.beginPath();
    ctx.arc(xOffset, yOffset, coords.z - 13.5, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.stroke();
  }
}

////////

L.TileLayer.AppleMapsTiles = L.TileLayer.extend({
  initialize: function (auth, opts) {
    this.auth = auth;
    L.setOptions(this, opts);
  },
  createTile: function (coords, done) {
    var tile = document.createElement("img");
    tile.alt = "";

    L.DomEvent.on(tile, "load", L.Util.bind(this._tileOnLoad, this, done, tile));
		L.DomEvent.on(tile, "error", L.Util.bind(this._tileOnError, this, done, tile));

    let url = "";
    switch (this.options.type) {
      default:
      case "road":
        url = `https://cdn3.apple-mapkit.com/ti/tile?` +
        `style=0&size=1&x=${coords.x}&y=${coords.y}&z=${coords.z}&scale=1` +
        `&lang=en&poi=1&tint=${this.options.tint}&emphasis=standard`;
        break;
      case "satellite":
        url = `https://sat-cdn1.apple-mapkit.com/tile?` +
              `style=7&size=1&scale=1&x=${coords.x}&y=${coords.y}&z=${coords.z}&v=9312`;
        break;
      case "satellite-overlay":
        url = `https://cdn1.apple-mapkit.com/ti/tile?` +
              `style=46&size=1&x=${coords.x}&y=${coords.y}&z=${coords.z}&scale=1&poi=0`;
        break;
    }

    this.auth.authenticateUrl(url)
      .then((url) => { tile.src = url; });
    done(null, tile);
    return tile;
  }
});

L.tileLayer.appleMapsTiles = function (auth, opts) {
  return new L.TileLayer.AppleMapsTiles(auth, opts);
}
