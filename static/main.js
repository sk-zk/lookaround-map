import "/static/layers.js";
import "https://cdn.jsdelivr.net/npm/three/build/three.min.js";
import "https://cdn.jsdelivr.net/npm/uevent@2/browser.min.js";
import "https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/photo-sphere-viewer.min.js";

let params = new URLSearchParams(window.location.hash.substring(1));

let center = params.has("c") // center
  ? params.get("c").split("/") 
  : [3, 20, 0]; // zoom, lat, lon

let map = L.map("map", {
  center: [center[1], center[2]],
  minZoom: 3,
  maxZoom: 19,
  zoom: center[0],
  preferCanvas: true,
  zoomControl: true,
});

const appleRoadLightTiles = L.tileLayer("/tiles/road/l/{z}/{x}/{y}/", {
  maxZoom: 19,
}).addTo(map);
const appleRoadDarkTiles = L.tileLayer("/tiles/road/d/{z}/{x}/{y}/", {
  maxZoom: 19,
});

const googleRoadTiles = L.tileLayer(
  "https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e0!2ssvv!4m2!1scb_client!2sapiv3!4m2!1scc!2s*211m3*211e2*212b1*213e2!3m3!3sUS!12m1!1e1!4e0",
  {
    maxZoom: 19,
  }
);

const debugCoords = L.gridLayer.debugCoords();

const coverageLayerNormal = L.gridLayer.coverage({
  minZoom: 17,
  maxZoom: 17,
  tileSize: 256,
});
const coverageLayer18 = L.gridLayer.coverage({
  minZoom: 18,
  maxZoom: 18,
  tileSize: 512,
});
const coverageLayer19 = L.gridLayer.coverage({
  minZoom: 19,
  maxZoom: 19,
  tileSize: 1024,
});
const coverageLayer16 = L.gridLayer.coverage({
  minZoom: 16,
  maxZoom: 16,
  tileSize: 128,
});
/* too slow
const coverageLayer15 = L.gridLayer.coverage({
  minZoom: 15,
  maxZoom: 15,
  tileSize: 64,
}); */

const coverageGroup = L.layerGroup([
  coverageLayerNormal,
  coverageLayer16,
  coverageLayer18,
  coverageLayer19,
]).addTo(map);
const baseLayers = {
  "Apple Maps Road (Light)": appleRoadLightTiles,
  "Apple Maps Road (Dark)": appleRoadDarkTiles,
  "Google Maps Road": googleRoadTiles,
};
const overlays = {
  '<div class="multiline-checkbox-label">Look Around coverage<br>(requires z=16 or higher)</div>': coverageGroup,
  "Tile boundaries": debugCoords,
};
L.control.layers(baseLayers, overlays).addTo(map);

function updateUrlParameters() {
  const center = map.getCenter();
  const zoom = map.getZoom();
  window.location.hash = `#c=${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
}

map.on('moveend', (e) => {
  updateUrlParameters();
});
map.on('zoomend', (e) => {
  updateUrlParameters();
});
map.on("click", async (e) => {
  const response = await fetch(`/closest/${e.latlng.lat}/${e.latlng.lng}/`);
  const pano = await response.json();
  if (pano) {
    const popup = L.popup();
    popup
      .setLatLng(L.latLng(pano.lat, pano.lon))
      .setContent(`
        <strong>${pano.panoid}</strong>/${pano.region_id}<br>
        ${pano.lat.toFixed(5)}, ${pano.lon.toFixed(5)}<br>
        ${pano.date}
      `)
      .on("remove", (e) => {
        const imgContainer = document.getElementById("pano"); 
        imgContainer.innerHTML = "";
        imgContainer.style.display = 'none';
      })
      .openOn(map);
  
    document.querySelector('#pano').style.display = 'block';
    const viewer = new PhotoSphereViewer.Viewer({
      container: document.querySelector('#pano'),
      panorama: `/pano/${pano.panoid}/${pano.region_id}/3/`,
      panoData: {
        fullWidth: 16384,
        fullHeight: 8192,
        croppedWidth: 16384,
        croppedHeight: 4352,
        croppedX: 0,
        croppedY: 1280,
      },
      minFov: 10,
      maxFov: 70,
    });
    viewer.config.showLoader = false;
    viewer.on('zoom-updated', (e, zoom_level) => {
      if (parseInt(viewer.config.panorama.slice(-2)[0]) != 0 && zoom_level >= 70) {
        viewer.setPanorama(`/pano/${pano.panoid}/${pano.region_id}/0/`, viewer.config);
        // lmk if there's a more faster and/or convenient way of improving the resolution
      }
    });

    // const imgContainer = document.getElementById("pano"); 
    // imgContainer.innerHTML = "";
    // const img = document.createElement("img");
    // img.src = `/pano/${pano.panoid}/${pano.region_id}/4/`;
    // imgContainer.appendChild(img);

    // for (let i = 0; i < 4; i++) { // ignore top/bottom faces for now
    //   const img = document.createElement("img");
    //   img.src = `/pano/${pano.panoid}/${pano.region_id}/${i}/3/`;
    //     imgContainer.appendChild(img);
    // }
  }
});
