import { Authenticator } from "../../util/Authenticator.js";
import { Constants } from "../Constants.js";

import TileLayer from 'ol/layer/Tile.js';
import LayerGroup from 'ol/layer/Group.js';
import XYZ from 'ol/source/XYZ.js';

const auth = new Authenticator();

async function tileLoadFunction(imageTile, src) {
  imageTile.getImage().src = await auth.authenticateUrl(src);
}

const appleRoad = new TileLayer({
  type: "base",
  title: "Apple Maps Road",
  source: new XYZ({
    maxZoom: 19,
    attributions: "© Apple",
    url:
      `https://cdn{1-4}.apple-mapkit.com/ti/tile?` +
      `style=0&size=1&x={x}&y={y}&z={z}&v=2210195&scale=1` +
      `&lang=en&poi=1&tint=light&emphasis=standard`,
    tileLoadFunction: tileLoadFunction,
  }),
});

const appleRoadDark = new TileLayer({
  type: "base",
  title: "Apple Maps Road (Dark)",
  visible: false,
  source: new XYZ({
    maxZoom: 19,
    attributions: "© Apple",
    url:
      `https://cdn{1-4}.apple-mapkit.com/ti/tile?` +
      `style=0&size=1&x={x}&y={y}&z={z}&v=2210195&scale=1` +
      `&lang=en&poi=1&tint=dark&emphasis=standard`,
    tileLoadFunction: tileLoadFunction,
  }),
});

const appleSatelliteImage = new TileLayer({
  source: new XYZ({
    maxZoom: 19,
    attributions: "© Apple",
    url:
      `https://sat-cdn{1-4}.apple-mapkit.com/tile?` +
      `style=7&size=1&scale=1&x={x}&y={y}&z={z}&v=9372`,
    tileLoadFunction: tileLoadFunction,
  }),
});
const appleSatelliteOverlay = new TileLayer({
  source: new XYZ({
    maxZoom: 19,
    attributions: "© Apple",
    url:
      `https://cdn{1-4}.apple-mapkit.com/ti/tile?` +
      `style=46&size=1&x={x}&y={y}&z={z}&scale=1&poi=0`,
    tileLoadFunction: tileLoadFunction,
  }),
});
const appleSatellite = new LayerGroup({
  title: "Apple Maps Satellite",
  type: "base",
  combine: "true",
  visible: false,
  layers: [appleSatelliteImage, appleSatelliteOverlay],
});

export { appleRoad, appleRoadDark, appleSatellite };
