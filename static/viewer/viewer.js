document.head.innerHTML += `
  <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/photo-sphere-viewer.min.css">
  <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4.7.0/dist/plugins/compass.css">
  <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4.7.0/dist/plugins/markers.css">
`;
import "https://cdn.jsdelivr.net/npm/three/build/three.min.js";
import "https://cdn.jsdelivr.net/npm/uevent@2/browser.min.js";
import "https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/photo-sphere-viewer.min.js";
import "https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4.7.0/dist/plugins/compass.js";
import "https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4.7.0/dist/plugins/markers.js";
import { LookaroundAdapter } from "/static/viewer/adapter.js";
import { MovementPlugin } from "/static/viewer/movementPlugin.js";


const LONGITUDE_OFFSET = 1.07992247; // 61.875°, which is the center of face 0

export function createPanoViewer(config) {
  const endpoint = config.endpoint ?? "";
  const plugins = configurePlugins(config);

  const viewer = new PhotoSphereViewer.Viewer({
    container: config.container,
    adapter: LookaroundAdapter,
    panorama: `/pano/${config.initialPano.panoid}/${config.initialPano.region_id}/`,
    panoData: { endpoint: endpoint },
    minFov: 10,
    maxFov: 70,
    defaultLat: 0,
    defaultLong: 0,
    defaultZoomLvl: 10,
    navbar: null,
    sphereCorrection: {
      pan: config.initialPano.north + LONGITUDE_OFFSET,
    },
    plugins: plugins,
  });

  viewer.navigateTo = async (pano) => {
    // for some reason, setPanorama doesn't appear to store the
    // new sphereCorrection anywhere, so I'm just passing it to the
    // viewer adapter manually
    viewer.panWorkaround = pano.north + LONGITUDE_OFFSET;
    await viewer.setPanorama(`/pano/${pano.panoid}/${pano.region_id}/`, {
      showLoader: false,
      sphereCorrection: {
        pan: pano.north + LONGITUDE_OFFSET,
      },
    });
    await viewer.plugins.movement.updatePanoMarkers(pano);
  };

  viewer.plugins.movement.updatePanoMarkers(config.initialPano);

  return viewer;
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
