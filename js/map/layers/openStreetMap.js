import { Constants } from "../Constants.js";

const openStreetMap = new ol.layer.Tile({
  title: "OpenStreetMap (Carto)",
  type: "base",
  visible: false,
  source: new ol.source.XYZ({
    url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    maxZoom: 19,
  }),
});

const cartoDbPositron = new ol.layer.Tile({
  title: "OpenStreetMap (Positron)",
  type: "base",
  visible: false,
  source: new ol.source.XYZ({
    url: 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://carto.com/attributions">CARTO</a>',
    tilePixelRatio: 2,
    maxZoom: 20,
  })
})

const cartoDbDarkMatter = new ol.layer.Tile({
  title: "OpenStreetMap (Dark Matter)",
  type: "base",
  visible: false,
  source: new ol.source.XYZ({
    url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://carto.com/attributions">CARTO</a>',
    tilePixelRatio: 2,
    maxZoom: 20,
  })
})

export { openStreetMap,  cartoDbPositron, cartoDbDarkMatter };
