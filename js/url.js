import { DEG2RAD, RAD2DEG, wrapLon } from "./geo/geo.js";
import { Constants } from "./map/Constants.js";
import "./proto/MuninViewState_pb.js";

import { Base64 } from "js-base64";

export function parseHashParams() {
  const params = new URLSearchParams(window.location.hash.substring(1));

  // share link
  if (params.has("s")) {
    const payload = decodeShareLinkPayload(params.get("s"));
    return {
      center: { zoom: 18, latitude: payload.lat, longitude: payload.lon },
      pano: { latitude: payload.lat, longitude: payload.lon, position: { yaw: payload.yaw, pitch: payload.pitch } },
    };
  }

  // normal link
  let center = null;
  if (params.has("c")) {
    const centerParams = params.get("c").split("/");
    center = {
      zoom: centerParams[0],
      latitude: centerParams[1],
      longitude: centerParams[2],
    };
  } else {
    center = { zoom: Constants.MIN_ZOOM, latitude: 20, longitude: 0 };
  }

  let pano = null;
  if (params.has("p")) {
    const panoParams = params.get("p").split("/");
    pano = { latitude: panoParams[0], longitude: panoParams[1] };
    if (params.has("a")) {
      const position = params.get("a").split("/");
      pano.position = { yaw: position[0] * DEG2RAD, pitch: position[1] * DEG2RAD };
    }
  }

  return {
    center: center,
    pano: pano,
  };
}

export function updateHashParams(map, currentPano, panoViewerPosition) {
  const view = map.getView();
  const center = view.getCenter();
  const zoom = view.getZoom();
  let newHash = `c=${zoom}/${center[1].toFixed(6)}/${wrapLon(center[0]).toFixed(6)}`;
  if (currentPano) {
    // there's no API call known to me which will return metadata for a
    // specific panoid like there is with streetview. this means that to fetch
    // pano metadata, its location must also be known, so I've decided to use
    // that for permalinks rather than panoids until I have a better solution
    newHash += `&p=${currentPano.lat.toFixed(6)}/${currentPano.lon.toFixed(6)}`;

    if (panoViewerPosition) {
      newHash += `&a=${(panoViewerPosition.yaw * RAD2DEG).toFixed(2)}/${(panoViewerPosition.pitch * RAD2DEG).toFixed(2)}`;
    }
  }
  // instead of setting window.location.hash directly, I set it like this
  // to not trigger a hashchanged event
  history.replaceState(null, null, document.location.pathname + "#" + newHash);
}

export function openInGsv(lat, lon, position, zoom) {
  const yaw = position.yaw * RAD2DEG;
  const pitch = position.pitch * RAD2DEG + 90;
  // estimated, but it works well enough
  zoom = -0.65 * zoom + 77.5;
  window.open(
    `https://www.google.com/maps/@${lat},${lon},3a,${zoom}y,${yaw}h,${pitch}t/data=!3m1!1e1`,
    "_blank"
  );
}

export function generateAppleMapsUrl(lat, lon, heading, position) {
  console.log(heading, position);
  const message = new proto.MuninViewState();
  const viewState = new proto.MuninViewState.ViewState();
  viewState.setLatitude(lat);
  viewState.setLongitude(lon);
  viewState.setYaw(position.yaw * RAD2DEG);
  viewState.setPitch(-position.pitch * RAD2DEG);
  message.setViewstate(viewState);
  const mvsParameter = Base64.fromUint8Array(message.serializeBinary());
  return `https://maps.apple.com/?ll=${lat},${lon}&_mvs=${mvsParameter}`;
}

export function encodeShareLinkPayload(lat, lon, yaw, pitch) {
  const floats = new Float32Array(4);
  floats[0] = lat;
  floats[1] = lon;
  floats[2] = yaw;
  floats[3] = pitch;
  const bytes = new Uint8Array(floats.buffer);
  return Base64.fromUint8Array(bytes, true);
}

export function decodeShareLinkPayload(payload) {
  const bytes = Base64.toUint8Array(payload, true);
  const floats = new Float32Array(bytes.buffer);
  return {
    lat: floats[0],
    lon: floats[1],
    yaw: floats[2],
    pitch: floats[3],
  };
}
