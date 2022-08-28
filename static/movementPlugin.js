import { geodeticToEnu, enuToPhotoSphere, distanceBetween } from "/static/geo.js";
import { ScreenFrustum } from "/static/util.js";

const MARKER_ID = "0";
const MAX_DISTANCE = 100;
const LONGITUDE_OFFSET = 1.07992247; // // 61.875°, which is the center of face 0
const CAMERA_HEIGHT = 2.4; // the approximated height of the camera

/**
 * A plugin which encapsulates navigating between Look Around panoramas.
 * 
 * The `moved` event is triggered when a user has moved to a new location.
 */
export class MovementPlugin extends PhotoSphereViewer.AbstractPlugin {
  static id = "movement";

  constructor(psv, options) {
    super(psv);
    this.marker = this.psv.plugins.markers.addMarker({
      id: MARKER_ID,
      longitude: 0,
      latitude: 0,
      image: "/static/marker2.png",
      width: 1,
      height: 1,
      opacity: 0.4,
      data: null,
      visible: false,
    });
    this.psv.container.addEventListener("mousemove", (e) => {
      this._onMouseMove(e);
    });
    this.psv.on("click", async (e, data) => {
      await this._onClick(e, data);
    });
    this.lastMousePosition = null;
    this.screenFrustum = new ScreenFrustum(this.psv);
    this.mouseHasMoved = false;
  }

  /**
   * For the given panorama, fetches nearby locations the user can navigate to.
   */
  async updatePanoMarkers(refPano) {
    const response = await fetch(`/closestTiles/${refPano.lat}/${refPano.lon}/`);
    const responsePanos = await response.json();

    this.nearbyPanos = [];
    for (const pano of responsePanos) {
      if (refPano.lat === pano.lat && refPano.lon === pano.lon) {
        // don't show a marker for the pano we're currently on
        continue;
      }

      // calculate height difference between this pano and the current one.
      // I can't make enough sense of the elevation value to just convert it
      // to meters first, but I can at least get a delta that's accurate enough
      // within a small area
      const deltaElevation = (pano.rawElevation - refPano.rawElevation) / 80;

      const enu = geodeticToEnu(
        pano.lon, pano.lat, deltaElevation,
        refPano.lon, refPano.lat, CAMERA_HEIGHT
      );
      const position = enuToPhotoSphere(enu, 0);

      if (position.distance > MAX_DISTANCE) continue;

      const scale = 0.05 + (0.5 - (0.5 * position.distance) / 100);
      this.nearbyPanos.push({ pano: pano, position: position, scale: scale });
    }
  }

  _onMouseMove(e) {
    this.mouseHasMoved = true;
    const vector = this.psv.dataHelper.viewerCoordsToVector3({
      x: e.clientX,
      y: e.clientY,
    });
    if (vector != null) {
      const position = this.psv.dataHelper.vector3ToSphericalCoords(vector);
      this.lastMousePosition = position;
      this._mouseMovedTo(position);
    } else {
      this._hideMarker();
    }
  }

  _mouseMovedTo(position) {
    if (!this.nearbyPanos) return;

    const closest = this._getClosestPano(position);
    if (closest === null) {
      this._hideMarker();
    } else {
      this.psv.plugins.markers.updateMarker({
        id: MARKER_ID,
        latitude: closest.position.pitch,
        longitude: closest.position.yaw,
        // TODO squish marker according to perspective.
        // width/height properties of a marker will always result in a square image for some reason
        width: 64 * closest.scale,
        height: 64 * closest.scale,
        visible: true,
        data: closest.pano,
      });
    }
  }

  async _onClick(e, data) {
    if (data.rightclick) {
      return;
    }
    if (!this.marker.visible || !this.marker.data) {
      if (this.mouseHasMoved) {
        return;
      } else {
        // mobile user
        const position = { latitude: data.latitude, longitude: data.longitude };
        const closest = this._getClosestPano(position);
        await this._navigateTo(closest.pano);
      }
    } else {
      await this._navigateTo(this.marker.data);
      this._hideMarker();
      // allow user to keep mouse in the same spot while clicking forward
      this._mouseMovedTo(this.lastMousePosition);
    }
  }

  async _navigateTo(pano) {
    this.psv.panWorkaround = pano.north + LONGITUDE_OFFSET;
    await this.psv.setPanorama(`/pano/${pano.panoid}/${pano.region_id}/`, {
      showLoader: false,
      sphereCorrection: {
        pan: pano.north + LONGITUDE_OFFSET,
      },
    });
    await this.updatePanoMarkers(pano);
    this.trigger("moved", pano);
  }

  _getClosestPano(position) {
    this.screenFrustum.update();
    let closest = null;
    let closestDist = 9999999;
    for (pano of this.nearbyPanos) {
      // ignore pano markers that aren't even on screen
      const viewerCoords = this.psv.dataHelper.sphericalCoordsToViewerCoords({
        latitude: pano.position.pitch,
        longitude: pano.position.yaw,
      });
      if (viewerCoords.x > this.psv.prop.size.width || viewerCoords.x < 0
        || viewerCoords.y > this.psv.prop.size.height || viewerCoords.y < 0) {
        continue;
      }
      const distance = distanceBetween(
        position.latitude, position.longitude,
        pano.position.pitch, pano.position.yaw,
        1);
      if (distance < closestDist) {
        closestDist = distance;
        closest = pano;
      }
    }
    return closest;
  }

  _hideMarker() {
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