import { Constants } from "../Constants.js";

import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';

const openStreetMap = new TileLayer({
  title: "OpenStreetMap (Carto)",
  type: "base",
  visible: false,
  source: new XYZ({
    url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    maxZoom: 19,
  }),
});

const cartoDbPositron = new TileLayer({
  title: "OpenStreetMap (Positron)",
  type: "base",
  visible: false,
  source: new XYZ({
    url: 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://carto.com/attributions">CARTO</a>',
    tilePixelRatio: 2,
    maxZoom: 20,
  })
})

const cartoDbDarkMatter = new TileLayer({
  title: "OpenStreetMap (Dark Matter)",
  type: "base",
  visible: false,
  source: new XYZ({
    url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://carto.com/attributions">CARTO</a>',
    tilePixelRatio: 2,
    maxZoom: 20,
  })
})

export { openStreetMap,  cartoDbPositron, cartoDbDarkMatter };
