import { Constants } from "../Constants.js";

const googleRoad = new ol.layer.Tile({
  title: "Google Maps Road",
  type: "base",
  visible: false,
  source: new ol.source.XYZ({
    maxZoom: Constants.MAX_ZOOM,
    attributions: "© Google",
    url: "https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e0!2ssvv!4m2!1scb_client!2sapiv3!4m2!1scc!2s*211m3*211e2*212b1*213e2!3m3!3sUS!12m1!1e1!4e0",
  }),
});

const googleStreetView = new ol.layer.Tile({
  title: "Google Street View",
  className: "gsv-coverage",
  visible: false,
  source: new ol.source.XYZ({
    maxZoom: Constants.MAX_ZOOM,
    attributions: "© Google",
    url: "https://mts.googleapis.com/vt?hl=en-US&lyrs=svv|cb_client:app&style=5,8&x={x}&y={y}&z={z}",
  }),
  opacity: 0.7,
});

export { googleRoad, googleStreetView };
