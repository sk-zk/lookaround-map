import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { CompassPlugin } from "@photo-sphere-viewer/compass-plugin";

import { Api } from "../Api.js";
import { LookaroundAdapter } from "./LookaroundAdapter.js";
import { MovementPlugin } from "./MovementPlugin.js";
import { DEG2RAD, distanceBetween } from "../geo/geo.js";
import { isHeicSupported, isHevcSupported } from "../util/media.js";
import { InitialOrientation, ImageFormat, AdditionalMetadata } from "../enums.js";
import { settings } from "../settings.js";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "@photo-sphere-viewer/compass-plugin/index.css";

export async function createPanoViewer(config) { 
  const apiBaseUrl = config.apiBaseUrl ?? "";
  config.canMove ??= true;
  config.compassEnabled ??= true;
  const plugins = configurePlugins(config);
  const initialOrientation = config.initialOrientation ?? InitialOrientation.North;
  const defaultYaw = getHeading(initialOrientation, config.initialPano.heading);
  const defaultZoomLvl = 20;

  let imageFormat;
  if (await isHeicSupported()) {
    imageFormat = ImageFormat.HEIC;
    console.log("fetching faces as HEIC");
  } else if (isHevcSupported() && settings.get("enableHevc")) {
    imageFormat = ImageFormat.HEVC;
    console.log("fetching faces as HEVC");
  } else {
    imageFormat = ImageFormat.JPEG;
    console.log("fetching faces as JPEG");
  }

  const viewer = new Viewer({
    container: config.container,
    adapter: LookaroundAdapter,
    panorama: { 
      panorama: config.initialPano, 
      url: `/pano/${config.initialPano.panoid}/${config.initialPano.buildId}/`,
    },
    panoData: { 
      apiBaseUrl: apiBaseUrl,
      imageFormat: imageFormat,
    },
    minFov: 10,
    maxFov: 100,
    defaultPitch: 0,
    defaultYaw: defaultYaw,
    defaultZoomLvl: defaultZoomLvl,
    navbar: null,
    sphereCorrection: {
      pan: config.initialPano.heading,
      tilt: config.initialPano.pitch,
      roll: config.initialPano.roll
    },
    plugins: plugins,
    rendererParameters: {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    }
  });

  viewer.api = new Api(apiBaseUrl);

  viewer.alternativeDatesChangedCallback = function() {};

  viewer.navigateTo = async (pano, resetView=false, showLoader=false) => {
    // when navigateTo is called from the movement plugin,
    // metadata needed for rendering will not be set, so we'll request it from the server
    if (!pano.heading) {
      pano = (await viewer.api.getClosestPanos(pano.lat, pano.lon, 5, 1, 
        [AdditionalMetadata.CameraMetadata, AdditionalMetadata.Elevation, 
          AdditionalMetadata.Orientation, AdditionalMetadata.TimeZone]))[0];
    }
    
    const setPanoramaOptions = {
      showLoader: showLoader,
      sphereCorrection: {
        pan: pano.heading,
        tilt: pano.pitch,
        roll: pano.roll
      },
    }

    if (resetView) {
      const heading = getHeading(initialOrientation, pano.heading);
      setPanoramaOptions.position = { yaw: heading, pitch: 0 }
    }

    await Promise.all([
      (async () => {
        await viewer.setPanorama({
          panorama: pano, 
          url: `/pano/${pano.panoid}/${pano.buildId}/`,
        }, setPanoramaOptions);
      })(),
      (async () => {
        await updateMarkers(viewer, pano);
      })()
    ]);
  };

  updateMarkers(viewer, config.initialPano);

  const crossfadeCanvas = document.createElement("canvas");
  crossfadeCanvas.id = "crossfade-canvas";
  document.querySelector(".psv-container").appendChild(crossfadeCanvas);
  var crossfadeCanvasStyle = document.createElement("style");
  crossfadeCanvasStyle.innerHTML = `
    #crossfade-canvas {
      z-index: 9;
      display: none;
      opacity: 1;
      position: absolute;
    }
  `;
  document.head.appendChild(crossfadeCanvasStyle);

  viewer.takeScreenshot = function() {
    return document.querySelector(".psv-canvas").toDataURL("image/jpeg", 1.0);
  }

  return viewer;
}

async function updateMarkers(viewer, pano) {
  const nearbyPanos = await viewer.api.getClosestPanos(
    pano.lat, pano.lon, 
    100, 1000, 
    [AdditionalMetadata.Elevation, AdditionalMetadata.TimeZone]);
  viewer.plugins.movement.updatePanoMarkers(pano, nearbyPanos);
  const alternativeDates = getAlternativeDates(pano, nearbyPanos);
  viewer.alternativeDatesChangedCallback(alternativeDates);
}

function getAlternativeDates(refPano, nearbyPanos) {
  const MAX_DISTANCE = 20 / 1000;
  const alternativeDates = {};
  const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeZone: refPano.timezone,
  });
  const refDate = dateTimeFormat.format(new Date(refPano.timestamp));
  for (const pano of nearbyPanos) {
    const date = dateTimeFormat.format(new Date(pano.timestamp));
    if (refDate === date) continue;

    const distance = distanceBetween(refPano.lat, refPano.lon, pano.lat, pano.lon);
    if (distance > MAX_DISTANCE) continue;

    if (alternativeDates[date]) {
      if (alternativeDates[date][1] > distance) {
        alternativeDates[date] = [pano, distance];
      }
    } else {
      alternativeDates[date] = [pano, distance];
    }
  }
  return Object.keys(alternativeDates)
    .map((x) => alternativeDates[x][0])
    .sort((a, b) => a.timestamp - b.timestamp);
}

function getHeading(initialOrientation, heading) {
  let defaultYaw;
  switch (initialOrientation) {
    case InitialOrientation.North:
    default:
      defaultYaw = 0;
      break;
    case InitialOrientation.Road:
      defaultYaw = -heading;
      break;
  }
  return defaultYaw;
}

function configurePlugins(config) {  
  const plugins = [];

  if (config.canMove) {
    plugins.push([MarkersPlugin, {}]);
    plugins.push([MovementPlugin, {}]);
  }

  const compassEnabled = config.compassEnabled ?? true;
  if (config.compassEnabled) {
    plugins.push(
      [
        CompassPlugin,
        { size: "80px" },
      ]);
  }

  return plugins;
}

export { InitialOrientation, Api, AdditionalMetadata };
