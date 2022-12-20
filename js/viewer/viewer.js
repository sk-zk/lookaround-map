document.head.innerHTML += `
  <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/photo-sphere-viewer.min.css">
  <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/plugins/compass.css">
  <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/plugins/markers.css">
`;
import "https://cdn.jsdelivr.net/npm/three/build/three.min.js";
import "https://cdn.jsdelivr.net/npm/uevent@2/browser.min.js";
import "https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/photo-sphere-viewer.min.js";
import "https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/plugins/compass.js";
import "https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/plugins/markers.js";
import { Api } from "../Api.js";
import { LookaroundAdapter } from "./LookaroundAdapter.js";
import { MovementPlugin } from "./MovementPlugin.js";
import { distanceBetween } from "../util/geo.js";


const LONGITUDE_OFFSET = 1.07992247; // 61.875°, which is the center of face 0

export const DefaultHeading = Object.freeze({
	North: 0,
	Road: 1,
})

export function createPanoViewer(config) {
  const endpoint = config.endpoint ?? "";
  const plugins = configurePlugins(config);
  const defaultHeading = config.defaultHeading ?? DefaultHeading.North;
  const defaultLong = getHeading(defaultHeading, config.initialPano.heading);
  const defaultZoomLvl = 10;

  const viewer = new PhotoSphereViewer.Viewer({
    container: config.container,
    adapter: LookaroundAdapter,
    panorama: { 
      panorama: config.initialPano, 
      url: `/pano/${config.initialPano.panoid}/${config.initialPano.regionId}/`,
    },
    panoData: { endpoint: endpoint },
    minFov: 10,
    maxFov: 70,
    defaultLat: 0,
    defaultLong: defaultLong,
    defaultZoomLvl: defaultZoomLvl,
    navbar: null,
    sphereCorrection: {
      pan: config.initialPano.heading + LONGITUDE_OFFSET,
    },
    plugins: plugins,
  });

  viewer.api = new Api(endpoint);

  viewer.alternativeDatesChangedCallback = function() {};

  viewer.navigateTo = async (pano, resetView=false) => {
    // for some reason, setPanorama doesn't appear to store the
    // new sphereCorrection anywhere, so I'm just passing it to the
    // viewer adapter manually
    viewer.panWorkaround = pano.heading + LONGITUDE_OFFSET;

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
      url: `/pano/${pano.panoid}/${pano.regionId}/`,
    }, {
      showLoader: false,
      sphereCorrection: {
        pan: pano.heading + LONGITUDE_OFFSET,
      },
    });
    if (resetView) {
      const heading = getHeading(defaultHeading, pano.heading);
      viewer.zoom(defaultZoomLvl);
      viewer.rotate({ latitude: 0, longitude: heading });
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
  let defaultLong;
  switch (defaultHeading) {
    case DefaultHeading.North:
    default:
      defaultLong = 0;
      break;
    case DefaultHeading.Road:
      defaultLong = -heading;
      break;
  }
  return defaultLong;
}

function configurePlugins(config) {  
  const plugins = [
    [PhotoSphereViewer.MarkersPlugin, {}],
    [MovementPlugin, {}],
  ];

  const compassEnabled = config.compassEnabled ?? true;
  if (compassEnabled) {
    plugins.push(
      [
        PhotoSphereViewer.CompassPlugin,
        { size: "80px" },
      ]);
  }

  return plugins;
}
