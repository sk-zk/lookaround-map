import { Constants } from "../Constants.js";
import { getDevicePixelRatio } from "../../util/misc.js";

import TileLayer from "ol/layer/Tile.js";
import XYZ from "ol/source/XYZ.js";

const pixelRatio = getDevicePixelRatio();

class GoogleRoadLayer extends TileLayer {
  constructor(languageTag) {
    const split = languageTag.split("-");
    const language = split[0];
    const region = split[1] ?? language;
    super({
      title: "Google Maps Road",
      type: "base",
      visible: false,
      source: new XYZ({
        maxZoom: Constants.MAX_ZOOM,
        attributions: "© Google",
        url:
          pixelRatio > 1
            ? `https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m2!1e0!2sm!3m5!2s${language}!3s${region}!5e1105!12m1!1e2!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0`
            : `https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m2!1e0!2sm!3m3!2s${language}!3s${region}!5e1105!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0`,
        tilePixelRatio: Math.min(2, pixelRatio),
      }),
    })
  }
}

const googleStreetView = new TileLayer({
  title: "Google Street View",
  className: "gsv-coverage",
  visible: false,
  source: new XYZ({
    maxZoom: Constants.MAX_ZOOM,
    attributions: "© Google",
    url:
      pixelRatio > 1
        ? "https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*211b0*212b1!3m7!2sen!3sus!5e1105!12m1!1e68!12m1!1e2!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0"
        : "https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*211b0*212b1!3m5!2sen!3sus!5e1105!12m1!1e68!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0",
    tilePixelRatio: Math.min(2, pixelRatio),
  }),
  opacity: 0.5,
});

export { GoogleRoadLayer, googleStreetView };
