import { Constants } from "../Constants.js";
import { getDevicePixelRatio } from "../../util/misc.js";

import TileLayer from "ol/layer/Tile.js";
import XYZ from "ol/source/XYZ.js";
import LayerGroup from "ol/layer/Group.js";

const pixelRatio = getDevicePixelRatio();

const openStreetMap = new TileLayer({
  title: "OpenStreetMap (Carto)",
  type: "base",
  visible: false,
  source: new XYZ({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    maxZoom: 19,
  }),
});

class CartoLayer extends TileLayer {
  constructor(style, zIndex = null) {
    const opts = {
      source: new XYZ({
        url: `https://{a-d}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}${pixelRatio > 1 ? "@2x" : ""}.png`,
        attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://carto.com/attributions">CARTO</a>',
        tilePixelRatio: Math.min(2, pixelRatio),
        maxZoom: 20,
      })
    };
    if (zIndex !== null) {
      opts.zIndex = zIndex;
    }
    super(opts);
  }
}

class CartoGroup extends LayerGroup {
  constructor(opts) {
    const base = new CartoLayer(opts.baseStyle);
    const labels = new CartoLayer(opts.labelStyle, Constants.LABELS_ZINDEX);
    super({
      title: opts.title,
      type: "base",
      visible: false,
      combine: true,
      layers: [base, labels]
    });
    this.base = base;
    this.labels = labels;
  }

  setLabelsOnTop(labelsOnTop) {
    this.labels.setZIndex(labelsOnTop ? Constants.LABELS_ZINDEX : Constants.LABELS_BELOW_ZINDEX);
    this.labels.changed();
  }
}

const cartoPositron = new CartoGroup({
  baseStyle: "light_nolabels",
  labelStyle: "light_only_labels",
  title: "OpenStreetMap (Positron)",
});

const cartoDarkMatter = new CartoGroup({
  baseStyle: "dark_nolabels",
  labelStyle: "dark_only_labels",
  title: "OpenStreetMap (Dark Matter)",
});

const cartoVoyager = new CartoGroup({
  baseStyle: "rastertiles/voyager_nolabels",
  labelStyle: "rastertiles/voyager_only_labels",
  title: "OpenStreetMap (Voyager)",
});

export { openStreetMap,  cartoPositron, cartoDarkMatter, cartoVoyager };
