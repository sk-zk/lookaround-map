import { approxEqual } from "./util/misc.js";
import { CoverageType, Face } from "./enums.js";

export class Api {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  async getCoverageTile(x, y) {
    const response = await fetch(`${this.baseUrl}/tiles/coverage/${x}/${y}/`);
    const tile = await response.json();
    return tile;
  }

  async getClosestPanos(lat, lon, radius, limit = null, additionalMetadata = null) {
    let url = `${this.baseUrl}/closest?lat=${lat}&lon=${lon}&radius=${radius}`;
    if (limit) {
      url += `&limit=${limit}`;
    }
    if (additionalMetadata) {
      url += `&meta=${additionalMetadata.join(",")}`;
    }
    const response = await fetch(url);
    const panos = await response.json();
    panos.forEach(this.#fixProjectionIfNecessary);
    return panos;
  }

  async reverseGeocode(lat, lon, language = "en-US") {
    let url = `${this.baseUrl}/address?lat=${lat}&lon=${lon}&lang=${language}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    const address = await response.json();
    return address;
  }

  #fixProjectionIfNecessary(pano) {
    // Some backpack panos have incorrect projection params, so we'll
    // override them with known good ones. This will break if Apple
    // ever releases any backpack footage which actually _does_ have a
    // different cy than this one.
    if (
      pano.coverageType === CoverageType.Trekker &&
      !approxEqual(pano.cameraMetadata[0].cy, 0.305432619)
    ) {
      for (let i = 0; i < 4; i++) {
        pano.cameraMetadata[i].cy = 0.305432619;
        pano.cameraMetadata[i].fovH = 1.832595715;
      }
      pano.cameraMetadata[Face.Bottom].fovS = 2.129301687;
      pano.cameraMetadata[Face.Bottom].fovH = 2.268928028;
    }

    // Likewise, some bigcam panos have the projection params of the
    // backpack cam / smallcam.
    // If they were taken before 2024/2025 (depending on region), we can
    // fix them easily because we can be certain they can't actually
    // be smallcam.
    if (
      pano.coverageType === CoverageType.Car &&
      approxEqual(pano.cameraMetadata[0].cy, 0.30543262)
    ) {
      // Before 2024
      if (pano.timestamp < 1704067200000) {
        // This does not apply to:
        // the 2022 CH coverage published on 2026-04-09,
        // the Büsingen enclave,
        // the Campione enclave.
        // Those were driven with the CH lowcam.
        if (
          pano.timezone !== "Europe/Zurich" &&
          pano.timezone !== "Europe/Busingen" &&
          pano.timezone !== "Europe/Rome"
        ) {
          for (let i = 0; i < 4; i++) {
            pano.cameraMetadata[i].cy = 0.27488935;
            pano.cameraMetadata[i].fovH = 1.6144296;
          }
        }
      }
      // Before 2025 (Europe)
      // e.g.: 54.691399, 25.279984; 8227292084070254447/2147486228
      else if (pano.timestamp < 1735689600000) {
        if (pano.timezone.startsWith("Eu")) {
          for (let i = 0; i < 4; i++) {
            pano.cameraMetadata[i].cy = 0.27488935;
            pano.cameraMetadata[i].fovH = 1.6144296;
          }
        }
      }
    }

    // Some of the February/March 2024 in New Orleans use the projection params
    // of bigcam, but since all of it was taken with smallcam,
    // this is incorrect.
    // e.g.: 29.938393, -90.067257; 4662376313210079974/2050648085
    if (
      pano.coverageType === CoverageType.Car &&
      pano.lat > 29.640968 &&
      pano.lat < 30.207505 &&
      pano.lon > -90.450698 &&
      pano.lon < -89.676162 &&
      pano.timestamp > 1706749261000 &&
      pano.timestamp < 1711933261000
    ) {
      for (let i = 0; i < 4; i++) {
        pano.cameraMetadata[i].cy = 0.305432619;
        pano.cameraMetadata[i].fovH = 1.832595715;
      }
    }
  }
  
}
