import { wgs84ToTileCoord } from "/static/geo.js";
import { LRUMap } from "/static/external/lru_js/lru.js";


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

// cache coverage tiles locally to stop leaflet from re-requesting everything
// every time the zoom level changes.
const coverageTileCache = new LRUMap(2**12);

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
      fetch(`/tiles/coverage/${coords.x}/${coords.y}/`)
        .then((response) => response.json())
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

////////

export function createMap(config) {
  let map = L.map("map", {
    center: [config.center.latitude, config.center.longitude],
    minZoom: 3,
    maxZoom: 19,
    zoom: config.center.zoom,
    preferCanvas: true,
    zoomControl: true,
  });

  const appleRoadLightTiles = L.tileLayer.appleMapsTiles(config.auth, {
    maxZoom: 19,
    type: "road",
    tint: "light",
    keepBuffer: 6,
    attribution: "© Apple",
  }).addTo(map);
  const appleRoadDarkTiles = L.tileLayer.appleMapsTiles(config.auth, {
    maxZoom: 19,
    type: "road",
    tint: "dark",
    keepBuffer: 6,
    attribution: "© Apple",
  });
  const appleSatelliteTiles = L.layerGroup([
    L.tileLayer.appleMapsTiles(config.auth, {
      maxZoom: 19,
      type: "satellite",
      keepBuffer: 6,
      attribution: "© Apple",
    }),
    L.tileLayer.appleMapsTiles(config.auth, {
      maxZoom: 19,
      type: "satellite-overlay",
      keepBuffer: 6,
      attribution: "© Apple",
    }),
  ]);

  const googleRoadTiles = L.tileLayer(
    "https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e0!2ssvv!4m2!1scb_client!2sapiv3!4m2!1scc!2s*211m3*211e2*212b1*213e2!3m3!3sUS!12m1!1e1!4e0",
    {
      maxZoom: 19,
      keepBuffer: 6,
      attribution: "© Google",
    }
  );
  const osmTiles = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      keepBuffer: 6,
      attribution: "© OpenStreetMap",
    }
  );

  const debugCoords = L.gridLayer.debugCoords();

  const coverageLayerNormal = L.gridLayer.coverage({
    minZoom: 17,
    maxZoom: 17,
    tileSize: 256,
  });
  const coverageLayer18 = L.gridLayer.coverage({
    minZoom: 18,
    maxZoom: 18,
    tileSize: 512,
  });
  const coverageLayer19 = L.gridLayer.coverage({
    minZoom: 19,
    maxZoom: 19,
    tileSize: 1024,
  });
  const coverageLayer16 = L.gridLayer.coverage({
    minZoom: 16,
    maxZoom: 16,
    tileSize: 128,
  });
  const coverageGroup = L.layerGroup([
    coverageLayer16,
    coverageLayerNormal,
    coverageLayer18,
    coverageLayer19,
  ]).addTo(map);

  const baseLayers = {
    "Apple Maps Road (Light)": appleRoadLightTiles,
    "Apple Maps Road (Dark)": appleRoadDarkTiles,
    "Apple Maps Satellite": appleSatelliteTiles,
    "Google Maps Road": googleRoadTiles,
    "OpenStreetMap": osmTiles,
  };
  const overlays = {
    '<div class="multiline-checkbox-label">Look Around coverage<br>(requires z=16 or higher)</div>': coverageGroup,
    "Tile boundaries": debugCoords,
  };
  L.control.layers(baseLayers, overlays).addTo(map);

  return map;
}
