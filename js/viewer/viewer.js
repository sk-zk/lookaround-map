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


const LONGITUDE_OFFSET = 1.07992247; // 61.875°, which is the center of face 0

export const DefaultHeading = Object.freeze({
	North: 0,
	Road: 1,
})

export function createPanoViewer(config) {
  const endpoint = config.endpoint ?? "";
  const plugins = configurePlugins(config);
  const defaultHeading = config.defaultHeading ?? DefaultHeading.North;
  const defaultLong = getHeading(defaultHeading, config.initialPano.north);
  const defaultZoomLvl = 10;

  const viewer = new PhotoSphereViewer.Viewer({
    container: config.container,
    adapter: LookaroundAdapter,
    panorama: { 
      panorama: config.initialPano, 
      url: `/pano/${config.initialPano.panoid}/${config.initialPano.region_id}/`,
    },
    panoData: { endpoint: endpoint },
    minFov: 10,
    maxFov: 70,
    defaultLat: 0,
    defaultLong: defaultLong,
    defaultZoomLvl: defaultZoomLvl,
    navbar: null,
    sphereCorrection: {
      pan: config.initialPano.north + LONGITUDE_OFFSET,
    },
    plugins: plugins,
  });

  viewer.api = new Api(endpoint);

  viewer.navigateTo = async (pano, resetView=false) => {
    // for some reason, setPanorama doesn't appear to store the
    // new sphereCorrection anywhere, so I'm just passing it to the
    // viewer adapter manually
    viewer.panWorkaround = pano.north + LONGITUDE_OFFSET;

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
      url: `/pano/${pano.panoid}/${pano.region_id}/`,
    }, {
      showLoader: false,
      sphereCorrection: {
        pan: pano.north + LONGITUDE_OFFSET,
      },
    });
    if (resetView) {
      const heading = getHeading(defaultHeading, pano.north);
      viewer.zoom(defaultZoomLvl);
      viewer.rotate({ latitude: 0, longitude: heading });
      viewer.adapter.dynamicLoadingEnabled = true;
      viewer.adapter.__refresh();
    }
    await viewer.plugins.movement.updatePanoMarkers(pano);
  };

  viewer.plugins.movement.updatePanoMarkers(config.initialPano);

  return viewer;
}

function getHeading(defaultHeading, north) {
  let defaultLong;
  switch (defaultHeading) {
    case DefaultHeading.North:
    default:
      defaultLong = 0;
      break;
    case DefaultHeading.Road:
      defaultLong = -north;
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
