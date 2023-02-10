import { Group, Mesh, SphereGeometry, MeshBasicMaterial, Vector3 } from "three";
import { mergeBufferGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CONSTANTS, utils } from "@photo-sphere-viewer/core"

import { AbstractAdapter } from "@photo-sphere-viewer/core";

import { ScreenFrustum } from "./ScreenFrustum.js";
import { Face } from "../enums.js";
import { Constants } from "../map/Constants.js";

const RENDER_TOP_AND_BOTTOM_FACES = false;
const FACES = RENDER_TOP_AND_BOTTOM_FACES ? 6 : 4;

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * @summary Adapter for Look Around panoramas
 * @memberof PSV.adapters
 * @extends PSV.adapters.AbstractAdapter
 */
export class LookaroundAdapter extends AbstractAdapter {
  static id = "lookaround";
  static supportsDownload = false;

  constructor(psv) {
    super(psv);
    this.psv = psv;

    this.endpoint = psv.config.panoData.endpoint;

    this.panorama = psv.config.panorama.panorama;
    this.url = psv.config.panorama.panorama.url;
    this.previousLatitudeSize = this.panorama.projection.latitudeSize;

    this.SPHERE_HORIZONTAL_SEGMENTS = 32;

    psv.addEventListener("position-updated", this);
    psv.addEventListener("zoom-updated", this);
    psv.addEventListener("before-rotate", this);

    this.screenFrustum = new ScreenFrustum(psv);

    this.dynamicLoadingEnabled = true;
  }

  /**
   * @override
   */
  supportsTransition() {
    return false;
  }

  /**
   * @override
   */
  supportsPreload() {
    return false;
  }

  /**
   * @override
   */
  loadTexture(panoramaMetadata) {
    this.panorama = panoramaMetadata.panorama;
    this.url = panoramaMetadata.url;

    // some trekker panos have longer side faces than regular car footage.
    // if this pano has a different projection from the last one, the mesh needs to be rebuilt.
    this.__recreateMeshIfNecessary();

    // initial load of the pano with a low starting quality.
    // higher resolution faces are loaded dynamically based on zoom level
    // and where the user is looking.
    const promises = [];
    const progress = [0, 0, 0, 0, 0, 0];
    const startZoom = 5;
    for (let i = 0; i < FACES; i++) {
      promises.push(this.__loadOneTexture(startZoom, i, progress));
    }
    return Promise.all(promises).then((texture) => ({ panorama: panoramaMetadata, texture }));
  }

  async __loadOneTexture(zoom, faceIdx, progress = null) {
    const faceUrl = `${this.endpoint}${this.url}${zoom}/${faceIdx}/`;
    return await this.psv.textureLoader
      .loadImage(faceUrl, (p) => {
        if (progress) {
          progress[faceIdx] = p;
          this.psv.loader.setProgress(
            utils.sum(progress) / 4
          );
        }
      })
      .then((img) => {
        let texture = null;
        texture = utils.createTexture(img);
        if (faceIdx == Face.Top) {
          // flip and cut off the edges a bit
          texture.center.set(0.5, 0.5);
          texture.repeat.set(-0.954, 0.954);
        }
        texture.userData = { zoom: zoom, url: this.url };
        return texture;
      });
  }

  __recreateMeshIfNecessary() {
    const latitudeSize = this.panorama.projection.latitudeSize;
    if (this.previousLatitudeSize !== latitudeSize) {
      this.psv.renderer.scene.remove(this.psv.renderer.meshContainer);

      const mesh = this.psv.adapter.createMesh();
      mesh.userData = { "psvSphere": true };
      this.psv.renderer.mesh = mesh;

      const meshContainer = new Group();
      meshContainer.add(mesh);
      this.psv.renderer.meshContainer = meshContainer;

      this.psv.renderer.scene.add(meshContainer);
    }
    this.previousLatitudeSize = latitudeSize;
  }

  /**
   * @override
   */
  createMesh(scale = 1) {
    const radius = CONSTANTS.SPHERE_RADIUS * scale;

    // some weird desperate nonsense to get most panos to render correctly
    let sideFaceThetaLength;
    let sideFaceThetaStart;
    if (Math.abs(this.panorama.projection.unknown34 -  degToRad(17.5)) < 0.01) {
      sideFaceThetaLength = degToRad(105);
      sideFaceThetaStart = degToRad(20);
    } else {
      sideFaceThetaLength = this.panorama.projection.latitudeSize;
      sideFaceThetaStart = degToRad(28);
    }

    let faces = [
      // radius, widthSegments, heightSegments,
      // phiStart, phiLength, thetaStart, thetaLength
      [
        radius,
        12 * 2,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(0-90),
        degToRad(120),
        sideFaceThetaStart,
        sideFaceThetaLength,
      ],
      [
        radius,
        6 * 2,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(120-90),
        degToRad(60),
        sideFaceThetaStart,
        sideFaceThetaLength,
      ],
      [
        radius,
        12 * 2,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(180-90),
        degToRad(120),
        sideFaceThetaStart,
        sideFaceThetaLength,
      ],
      [
        radius,
        6 * 2,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(300-90),
        degToRad(60),
        sideFaceThetaStart,
        sideFaceThetaLength,
      ],
    ];
    if (RENDER_TOP_AND_BOTTOM_FACES) {
      faces.push([
        radius,
        36 * 4,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(0),
        degToRad(360),
        degToRad(0),
        sideFaceThetaStart,
      ],
      [
        radius,
        36 * 4,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(0),
        degToRad(360),
        sideFaceThetaStart + sideFaceThetaLength,
        degToRad(180) - sideFaceThetaStart - sideFaceThetaLength,
      ]);
    }
    const geometries = [];
    this.meshesForFrustum = [];
    for (let i = 0; i < faces.length; i++) {
      const geom = new SphereGeometry(...faces[i]).scale(-1, 1, 1);
      if (i < Face.Top) {
        this.__setSideUV(geom, i);
      } else {
        this.__setTopBottomUV(geom, i);
      }
      if (i == Face.Top) {
        geom.rotateY(degToRad(27.5 + 90));
      }
      else if (i == Face.Bottom) {
        geom.scale(1,1,1.5);
        geom.rotateY(degToRad(27.5 - 90));
      }
      geometries.push(geom);
      this.meshesForFrustum.push(new Mesh(geom, []));
    }

    const mergedGeometry = mergeBufferGeometries(geometries, true);
    const mesh = new Mesh(
      mergedGeometry,
      Array(FACES).fill(new MeshBasicMaterial())
    );
    this.mesh = mesh;
    return mesh;
  }

  /**
   * Sets the UVs for side faces such that the overlapping portion is removed
   * without having to crop the texture beforehand every time.
   */
  __setSideUV(geom, faceIdx) {
    const uv = geom.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      let u = uv.getX(i);
      let v = uv.getY(i);
      const overlap = (faceIdx % 2 === 0) 
        ? 1 - 1/22  // 120° faces  
        : 1 - 1/12; // 60° faces
      u *= overlap;
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }

  __setTopBottomUV(geom, faceIdx) {
    if (faceIdx < Face.Top) return;

    const uv = geom.getAttribute("uv");
    const position = geom.getAttribute("position")
    const largestX =
      faceIdx == Face.Top 
        ? position.getX(position.count - 1) 
        : position.getX(0);
    for (let i = 0; i < uv.count; i++) {
      let u = position.getX(i);
      let v = position.getZ(i);
      u =
        i == Face.Top
          ? u / (2 *  largestX) + 0.5
          : u / (2 * -largestX) + 0.5;
      v = v / (2 * largestX) + 0.5;

      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }

  /**
   * @override
   */
  setTexture(mesh, textureData) {
    for (let i = 0; i < FACES; i++) {
      if (textureData.texture[i]) {
        mesh.material[i] = new MeshBasicMaterial({
          map: textureData.texture[i],
        });
      }
    }
    this.__refresh(); // immediately replace the low quality tiles from intial load
  }

  /**
   * @override
   */
  setTextureOpacity(mesh, opacity) {
    for (let i = 0; i < FACES; i++) {
      mesh.material[i].opacity = opacity;
      mesh.material[i].transparent = opacity < 1;
    }
  }

  /**
   * @override
   */
  disposeTexture(textureData) {
    textureData.texture?.forEach((texture) => texture.dispose());
  }

  /**
   * @private
   */
  handleEvent(e) {
    switch (e.type) {
      case "before-rotate":
        // the rotate() method of the viewer only fires BEFORE_ROTATE
        // and not POSITION_UPDATED, so I had to restort to handling
        // BEFFORE_ROTATE instead and passing the rotation param from it
        // all the way to __getVisibleFaces()
        this.__refresh(e.position);
        break;
      case "zoom-updated":
        this.__refresh();
        break;
    }
  }

  __refresh(position=null) {
    if (!this.mesh) return;
    if (this.mesh.material.length === 0) return;
    if (!this.dynamicLoadingEnabled) return;
    
    const visibleFaces = this.__getVisibleFaces(position);
    // TODO finetune this
    if (this.psv.renderer.state.vFov < 55) {
      this.__refreshFaces(visibleFaces, 0);
    } else {
      this.__refreshFaces(visibleFaces, 2);
    }
  }

  __refreshFaces(faces, zoom) {
    for (const faceIdx of faces) {
      if (
        this.mesh.material[faceIdx].map &&
        this.mesh.material[faceIdx].map.userData.zoom > zoom &&
        !this.mesh.material[faceIdx].map.userData.refreshing
      ) {
        this.mesh.material[faceIdx].map.userData.refreshing = true;
        const oldUrl = this.mesh.material[faceIdx].map.userData.url;
        this.__loadOneTexture(zoom, faceIdx).then((texture) => {
          if (this.mesh.material[faceIdx].map.userData.url == oldUrl) {
            // ^ dumb temp fix to stop faces from loading in
            // after the user has already navigated to a different one
            this.mesh.material[faceIdx] = new MeshBasicMaterial({
              map: texture,
            });
            this.mesh.material[faceIdx].map.userData.refreshing = false;
            this.psv.needsUpdate();
          }
        });
      }
    }
  }

  __getVisibleFaces(position=null) {
    const yaw = position?.yaw ?? null;
    this.screenFrustum.update(yaw);

    // TODO find a more elegant way to do this
    const visibleFaces = [];
    for (let meshIdx = 0; meshIdx < this.meshesForFrustum.length; meshIdx++) {
      const mesh = this.meshesForFrustum[meshIdx];
      const position = mesh.geometry.getAttribute("position");
      const step = 20;
      for (let i = 0; i < position.count; i += step) {
        const point = new Vector3().fromBufferAttribute(position, i);
        if (this.screenFrustum.frustum.containsPoint(point)) {
          visibleFaces.push(meshIdx);
          break;
        }
      }
    }
    return visibleFaces;
  }

}
