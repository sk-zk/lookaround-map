import { Authenticator } from "../../util/Authenticator.js";
import { getDevicePixelRatio } from "../../util/misc.js";

import TileLayer from "ol/layer/Tile.js";
import XYZ from "ol/source/XYZ.js";

const auth = new Authenticator();

async function tileLoadFunction(imageTile, src) {
  imageTile.getImage().src = await auth.authenticateUrl(src);
}

const AppleMapsLayerType = Object.freeze({
  Road: "road",
  RoadDark: "roadDark",
  Satellite: "satellite",
  SatelliteOverlay: "hybrid",
});

const AppleMapsTileType = Object.freeze({
  Road: "road",
  Satellite: "satellite",
});

const Tint = Object.freeze({
  Light: "light",
  Dark: "dark",
});

const Emphasis = Object.freeze({
  Standard: "standard",
  Muted: "muted",
});

function generateTileUrl(opts, pixelRatio) {
  switch (opts.tileType) {
    default:
    case AppleMapsTileType.Road:
      opts.tint ??= Tint.Light;
      opts.emphasis ??= Emphasis.Standard;
      opts.labels ??= true;
      opts.poi ??= true;
      opts.style ??= 0;
      return `https://cdn{1-4}.apple-mapkit.com/ti/tile?` +
        `style=${opts.style}&size=1&x={x}&y={y}&z={z}&v=2303284&scale=${pixelRatio}` +
        `&lang=${opts.lang}` +
        `&poi=${(opts.poi && opts.labels) ? "1" : "0"}` +
        `&tint=${opts.tint}` +
        `&emphasis=${opts.emphasis}` +
        `&labels=${opts.labels ? "1" : "0"}`;
    case AppleMapsTileType.Satellite:
      return `https://sat-cdn{1-4}.apple-mapkit.com/tile?` +
        `style=7&size=${Math.min(2, pixelRatio)}&scale=1&x={x}&y={y}&z={z}&v=9421`;
  }
}

class AppleTileSource extends XYZ {
  constructor(opts) {
    opts ??= {};
    opts.tileType ??= AppleMapsTileType.Road;
    opts.lang ??= "en";
    const pixelRatio = getDevicePixelRatio();

    super({
      maxZoom: 20,
      attributions: "© Apple",
      url: generateTileUrl(opts, pixelRatio),     
      tilePixelRatio: pixelRatio,
      tileLoadFunction: tileLoadFunction,
      crossOrigin: "",
    });

    this.opts = opts;
  }

  setEmphasis(emphasis) {
    this.opts.emphasis = emphasis;
    this.setUrl(generateTileUrl(this.opts, getDevicePixelRatio()))
    this.changed();
  }
}

class AppleTileLayer extends TileLayer {
  constructor(opts) {
    opts ??= {};
    opts.lang ??= "en";
    opts.layerType ??= AppleMapsLayerType.Road;

    let source = null;
    let type = null;
    switch (opts.layerType) {
      default:
      case AppleMapsLayerType.Road:
        source = new AppleTileSource({
          lang: opts.lang,
        });
        type = "base";
        break;
      case AppleMapsLayerType.RoadDark:
        source = new AppleTileSource({
          tint: Tint.Dark,
          lang: opts.lang,
        });
        type = "base";
        break;
        case AppleMapsLayerType.Satellite:
          source = new AppleTileSource({
            tileType: AppleMapsTileType.Satellite,
          });
          break;
      case AppleMapsLayerType.SatelliteOverlay:
          source = new AppleTileSource({
            style: 46,
            lang: opts.lang,
            poi: false,
          });
          break;
    }

    const superOpts = {
      title: opts.title,
      source: source,
    };
    if (type) {
      superOpts.type = type;
    }
    if (opts.visible) {
      superOpts.visible = opts.visible;
    }
    super(superOpts);
  }
}

export { AppleTileLayer, AppleMapsLayerType, AppleMapsTileType, Emphasis };
