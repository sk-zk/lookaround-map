import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { CompassPlugin } from "@photo-sphere-viewer/compass-plugin";

import { Api } from "../Api.js";
import { LookaroundAdapter } from "./LookaroundAdapter.js";
import { MovementPlugin } from "./MovementPlugin.js";
import { DEG2RAD, distanceBetween } from "../geo/geo.js";
import { isHeicSupported } from "../util/misc.js";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "@photo-sphere-viewer/compass-plugin/index.css";

export const DefaultHeading = Object.freeze({
	North: 0,
	Road: 1,
})

export async function createPanoViewer(config) { 
  const endpoint = config.endpoint ?? "";
  const plugins = configurePlugins(config);
  const defaultHeading = config.defaultHeading ?? DefaultHeading.North;
  const defaultYaw = getHeading(defaultHeading, config.initialPano.heading);
  const defaultZoomLvl = 20;
  const useHeic = await isHeicSupported();

  const viewer = new Viewer({
    container: config.container,
    adapter: LookaroundAdapter,
    panorama: { 
      panorama: config.initialPano, 
      url: `/pano/${config.initialPano.panoid}/${config.initialPano.buildId}/`,
    },
    panoData: { 
      endpoint: endpoint,
      useHeic: useHeic,
    },
    minFov: 10,
    maxFov: 100,
    defaultPitch: 0,
    defaultYaw: defaultYaw,
    defaultZoomLvl: defaultZoomLvl,
    navbar: null,
    sphereCorrection: {
      pan: config.initialPano.heading,
      //tilt: config.initialPano.pitch,
      //roll: config.initialPano.roll
    },
    plugins: plugins,
    rendererParameters: {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    }
  });

  viewer.api = new Api(endpoint);

  viewer.alternativeDatesChangedCallback = function() {};

  viewer.navigateTo = async (pano, resetView=false) => {
    // for some reason, setPanorama doesn't appear to store the
    // new sphereCorrection anywhere, so I'm just passing it to the
    // viewer adapter manually
    viewer.panWorkaround = pano.heading;

    if (resetView) {
      // temporarily disable dynamic face loading.
      // this is necessary because setPanorama() doesn't have a parameter for
      // changing the viewing angle, so you need to do that afterwards with
      // rotate() - but that results in loading more faces than are actually
      // on the screen, which is a waste of time and bandwidth.
      viewer.adapter.dynamicLoadingEnabled = false;
    }
    await viewer.setPanorama({ 
      panorama: pano, 
      url: `/pano/${pano.panoid}/${pano.buildId}/`,
    }, {
      showLoader: false,
      sphereCorrection: {
        pan: pano.heading,
        //tilt: pano.pitch,
        //roll: pano.roll
      },
    });
    if (resetView) {
      const heading = getHeading(defaultHeading, pano.heading);
      viewer.zoom(defaultZoomLvl);
      viewer.rotate({ pitch: 0, yaw: heading });
      viewer.adapter.dynamicLoadingEnabled = true;
      viewer.adapter.__refresh();
    }
    const nearbyPanos = await viewer.api.getPanosAroundPoint(pano.lat, pano.lon, 100);
    viewer.plugins.movement.updatePanoMarkers(pano, nearbyPanos);
    const alternativeDates = getAlternativeDates(pano, nearbyPanos);
    viewer.alternativeDatesChangedCallback(alternativeDates);
  };

  viewer.api.getPanosAroundPoint(config.initialPano.lat, config.initialPano.lon, 100)
    .then((nearbyPanos) => {
      viewer.plugins.movement.updatePanoMarkers(config.initialPano, nearbyPanos);
      const alternativeDates = getAlternativeDates(config.initialPano, nearbyPanos);
      viewer.alternativeDatesChangedCallback(alternativeDates);
    });

  viewer.takeScreenshot = function() {
    return document.querySelector(".psv-canvas").toDataURL("image/jpeg", 1.0);
  }

  return viewer;
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

function getHeading(defaultHeading, heading) {
  let defaultYaw;
  switch (defaultHeading) {
    case DefaultHeading.North:
    default:
      defaultYaw = 0;
      break;
    case DefaultHeading.Road:
      defaultYaw = -heading;
      break;
  }
  return defaultYaw;
}

function configurePlugins(config) {  
  const plugins = [
    [MarkersPlugin, {}],
    [MovementPlugin, {}],
  ];

  const compassEnabled = config.compassEnabled ?? true;
  if (compassEnabled) {
    plugins.push(
      [
        CompassPlugin,
        { size: "80px" },
      ]);
  }

  return plugins;
}
