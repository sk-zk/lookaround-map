import { Authenticator } from "../../util/Authenticator.js";

import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';

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

class AppleTileSource extends XYZ {
  constructor(opts) {
    opts ??= {};
    opts.tileType ??= AppleMapsTileType.Road;
    opts.lang ??= "en";

    let url;
    switch (opts.tileType) {
      default:
      case AppleMapsTileType.Road:
        opts.tint ??= Tint.Light;
        opts.emphasis ??= Emphasis.Standard;
        opts.labels ??= true;
        opts.poi ??= true;
        opts.style ??= 0;
        url =
        `https://cdn{1-4}.apple-mapkit.com/ti/tile?` +
        `style=${opts.style}&size=1&x={x}&y={y}&z={z}&v=2303284&scale=1` +
        `&lang=${opts.lang}` + 
        `&poi=${(opts.poi && opts.labels) ? "1" : "0"}` + 
        `&tint=${opts.tint}`+ 
        `&emphasis=${opts.emphasis}`+ 
        `&labels=${opts.labels ? "1" : "0"}`;
        break;
      case AppleMapsTileType.Satellite:
        opts.poi ??= false;
        url =
        `https://sat-cdn{1-4}.apple-mapkit.com/tile?` +
        `style=7&size=1&scale=1&x={x}&y={y}&z={z}&v=9372&poi=${opts.poi ? "1" : "0"}`
    }

    super({
      maxZoom: 19,
      attributions: "© Apple",
      url: url,     
      tileLoadFunction: tileLoadFunction,
    });

    this.opts = opts;
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

export { AppleTileLayer, AppleMapsLayerType, AppleMapsTileType };
