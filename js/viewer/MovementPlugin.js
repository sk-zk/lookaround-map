import { AbstractPlugin } from "@photo-sphere-viewer/core";
import { geodeticToEnu, enuToPhotoSphere, distanceBetween } from "../geo/geo.js";
import { ScreenFrustum } from "./ScreenFrustum.js";

const MARKER_ID = "0";
const MAX_DISTANCE = 100;
const CAMERA_HEIGHT = 2.4; // the approximated height of the camera

/**
 * A plugin which encapsulates navigating between Look Around panoramas.
 * 
 * The `moved` event is triggered when a user has moved to a new location.
 */
export class MovementPlugin extends AbstractPlugin {
  static id = "movement";

  constructor(psv, options) {
    super(psv);
    this.psv = psv;

    psv.plugins.markers.addMarker({
      id: MARKER_ID,
      position: { yaw: 0, pitch: 0 },
      size: { width: 1, height: 1 },
      scale: { zoom: [0.5, 1] }, 
      image: `${this.psv.config.panoData.apiBaseUrl}/static/marker.png`,
      opacity: 0.4,
      data: null,
      visible: false,
    });
    // addMarker no longer returns the marker object in psv 5?
    this.marker = psv.plugins.markers.markers["0"];
    psv.container.addEventListener("mousemove", (e) => {
      this.#onMouseMove(e);
    });
    psv.addEventListener("click", async (e) => {
      await this.#onClick(e);
    });
    this.lastMousePosition = null;
    this.screenFrustum = new ScreenFrustum(psv);
    this.mouseHasMoved = false;
    this.lastProcessedMoveEvent = 0;
    this.movementEnabled = true;
  }

  /**
   * For the given panorama, fetches nearby locations the user can navigate to.
   */
  updatePanoMarkers(refPano, panos) {
    this.nearbyPanos = [];

    for (const pano of panos) {
      if (refPano.lat === pano.lat && refPano.lon === pano.lon) {
        // don't show a marker for the pano we're currently on
        continue;
      }

      const deltaEle = pano.elevation - refPano.elevation;
      const enu = geodeticToEnu(
        pano.lon, pano.lat, deltaEle,
        refPano.lon, refPano.lat, CAMERA_HEIGHT
      );
      const position = enuToPhotoSphere(enu, 0);

      if (position.distance > MAX_DISTANCE) continue;

      const scale = 0.05 + (0.5 - (0.5 * position.distance) / 100);
      this.nearbyPanos.push({ pano: pano, position: position, scale: scale });
    }
  }

  #onMouseMove(e) {
    this.mouseHasMoved = true;
       
    const updateLimit = 1000/60.0;
    const now = Date.now();
    const msSinceLastUpdate = now - this.lastProcessedMoveEvent;
    
    if (msSinceLastUpdate > updateLimit) {
      this.lastProcessedMoveEvent = now;
      const vector = this.psv.dataHelper.viewerCoordsToVector3({
        x: e.clientX,
        y: e.clientY,
      });
      if (vector != null) {
        const position = this.psv.dataHelper.vector3ToSphericalCoords(vector);
        this.lastMousePosition = position;
        this.#mouseMovedTo(position);
      } else {
        this.#hideMarker();
      }
    }
  }

  #mouseMovedTo(position) {
    if (!this.nearbyPanos || !this.movementEnabled) return;

    const closest = this.#getClosestPano(position);
    if (closest === null) {
      this.#hideMarker();
    } else {
      this.psv.plugins.markers.updateMarker({
        id: MARKER_ID,
        position: { pitch: closest.position.pitch, yaw: closest.position.yaw },
        // TODO squish marker according to perspective.
        // width/height properties of a marker will always result in a square image for some reason
        size: { width: 100 * closest.scale, height: 100 * closest.scale},
        visible: true,
        data: closest.pano,
      });
    }
  }

  async #onClick(e) {
    if (e.data.rightclick || !this.movementEnabled) {
      return;
    }

    if (!this.marker.state.visible || !this.marker.config.data) {
      if (this.mouseHasMoved) {
        return;
      } else {
        // mobile user
        const position = { pitch: e.data.pitch, yaw: e.data.yaw };
        const closest = this.#getClosestPano(position);
        await this.#navigateTo(closest.pano);
      }
    } else {
      const pano = this.marker.config.data;
      this.#hideMarker();
      this.movementEnabled = false;
      await this.#navigateTo(pano);
      this.movementEnabled = true;
      // allow user to keep mouse in the same spot while clicking forward
      this.#mouseMovedTo(this.lastMousePosition);
    }
  }

  async #navigateTo(pano) {
    await this.psv.navigateTo(pano);
    this.dispatchEvent(new CustomEvent("moved", { detail: pano }));
  }

  #getClosestPano(position) {
    this.screenFrustum.update();
    let closest = null;
    let closestDist = 9999999;
    for (const pano of this.nearbyPanos) {
      // ignore pano markers that aren't even on screen
      if (this.#markerPositionIsOffScreen(pano.position)) continue;
      const distance = distanceBetween(
        position.pitch, position.yaw,
        pano.position.pitch, pano.position.yaw,
        1);
      if (distance < closestDist) {
        closestDist = distance;
        closest = pano;
      }
    }
    return closest;
  }

  #markerPositionIsOffScreen(pano_position) {
    const viewerCoords = this.psv.dataHelper.sphericalCoordsToViewerCoords({
      pitch: pano_position.pitch,
      yaw: pano_position.yaw,
    });
    return viewerCoords.x > this.psv.state.size.width  || viewerCoords.x < 0 ||
           viewerCoords.y > this.psv.state.size.height || viewerCoords.y < 0;
  }

  #hideMarker() {
    this.psv.plugins.markers.updateMarker({
      id: MARKER_ID,
      visible: false,
      data: null,
    });
  }

  destroy() {
    super.destroy();
  }
}