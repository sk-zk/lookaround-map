import { Constants } from "../Constants.js";

import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';

const googleRoad = new TileLayer({
  title: "Google Maps Road",
  type: "base",
  visible: false,
  source: new XYZ({
    maxZoom: Constants.MAX_ZOOM,
    attributions: "© Google",
    url: "https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e0!2ssvv!4m2!1scb_client!2sapiv3!4m2!1scc!2s*211m3*211e2*212b1*213e2!3m3!3sUS!12m1!1e1!4e0",
  }),
});

const googleStreetView = new TileLayer({
  title: "Google Street View",
  className: "gsv-coverage",
  visible: false,
  source: new XYZ({
    maxZoom: Constants.MAX_ZOOM,
    attributions: "© Google",
    url: "https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*211b0*212b1!3m5!2sen!3sus!5e1105!12m1!1e68!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0",
  }),
  opacity: 0.5,
});

export { googleRoad, googleStreetView };
