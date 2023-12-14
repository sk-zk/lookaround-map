import { Group, Mesh, SphereGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { settings } from "../settings.js";
import { ScreenFrustum } from "./ScreenFrustum.js";
import { Face, ImageFormat } from "../enums.js";
import { getFirstFrameOfVideo } from "../util/media.js";

import { CONSTANTS, utils, AbstractAdapter } from "@photo-sphere-viewer/core"

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

const YAW_OFFSET = 1.07992247; // 61.875°, which is the center of face 0

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

    this.renderTopAndBottomFaces = settings.get("showFullPano");
    this.faceAmount = this.renderTopAndBottomFaces ? 6 : 4;
    this.imageFormat = psv.config.panoData.imageFormat;
    this.endpoint = psv.config.panoData.endpoint;

    this.panorama = psv.config.panorama.panorama;
    this.url = psv.config.panorama.panorama.url;
    this.previousFovH = this.panorama.lensProjection.fovH;

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
    for (let i = 0; i < this.faceAmount; i++) {
      promises.push(this.__loadOneTexture(startZoom, i, progress));
    }
    return Promise.all(promises).then((texture) => ({ panorama: panoramaMetadata, texture }));
  }

  async __loadOneTexture(zoom, faceIdx, progress = null) {
    let faceUrl = `${this.endpoint}${this.url}${zoom}/${faceIdx}/`;
    if (this.imageFormat === ImageFormat.HEIC) {
      faceUrl += "?format=heic";
    } else if (this.imageFormat === ImageFormat.HEVC) {
      faceUrl += "?format=hevc";
    }
    // otherwise, load JPEG; no parameter necessary

    return this.psv.textureLoader
      .loadFile(faceUrl, (p) => {
        if (progress) {
          progress[faceIdx] = p;
          this.psv.loader.setProgress(
            utils.sum(progress) / 4
          );
        }
      })
      .then(async (file) => {
        let texture = null;
        if (this.imageFormat === ImageFormat.HEVC) {
          const objectUrl = URL.createObjectURL(file);
          const frame = await getFirstFrameOfVideo(objectUrl, "video/mp4");
          texture = utils.createTexture(frame);
          URL.revokeObjectURL(objectUrl);
        } else {
          const img = await this.psv.textureLoader.blobToImage(file);
          texture = utils.createTexture(img);
        }
        if (faceIdx === Face.Top) {
          texture.flipY = false;
        }
        texture.userData = { zoom: zoom, url: this.url };

        return texture;
      });
  }

  __recreateMeshIfNecessary() {
    const fovH = this.panorama.lensProjection.fovH;
    if (this.previousFovH !== fovH) {
      const mesh = this.createMesh();
      mesh.userData = { ["photoSphereViewer"]: true };
      mesh.parent = this.psv.renderer.meshContainer;

      this.psv.renderer.mesh = mesh;
      this.psv.renderer.meshContainer.children = [mesh];

      mesh.updateMatrixWorld(true);
    }
    this.previousFovH = fovH;
  }

  /**
   * @override
   */
  createMesh(scale = 1) {
    const radius = CONSTANTS.SPHERE_RADIUS * scale;

    // some weird desperate nonsense to get most panos to render correctly
    let sideFaceThetaLength;
    let sideFaceThetaStart;
    if (Math.abs(this.panorama.lensProjection.cy - degToRad(17.5)) < 0.01) {
      sideFaceThetaLength = degToRad(105);
      sideFaceThetaStart = degToRad(20);
    } else {
      sideFaceThetaLength = this.panorama.lensProjection.fovH;
      sideFaceThetaStart = degToRad(28);
    }

    let faces = [
      // radius, widthSegments, heightSegments,
      // phiStart, phiLength, thetaStart, thetaLength
      [
        radius,
        12 * 2,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(0-90) - YAW_OFFSET,
        degToRad(120),
        sideFaceThetaStart,
        sideFaceThetaLength,
      ],
      [
        radius,
        6 * 2,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(120-90) - YAW_OFFSET,
        degToRad(60),
        sideFaceThetaStart,
        sideFaceThetaLength,
      ],
      [
        radius,
        12 * 2,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(180-90) - YAW_OFFSET,
        degToRad(120),
        sideFaceThetaStart,
        sideFaceThetaLength,
      ],
      [
        radius,
        6 * 2,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(300-90) - YAW_OFFSET,
        degToRad(60),
        sideFaceThetaStart,
        sideFaceThetaLength,
      ],
    ];
    if (this.renderTopAndBottomFaces) {
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
        geom.rotateY(degToRad(27.5 - 90) + YAW_OFFSET);
      }
      else if (i == Face.Bottom) {
        geom.scale(1,1,1.5);
        geom.rotateY(degToRad(27.5 - 90) + YAW_OFFSET);
      }
      geometries.push(geom);
      this.meshesForFrustum.push(new Mesh(geom, []));
    }

    const mergedGeometry = mergeGeometries(geometries, true);
    const mesh = new Mesh(
      mergedGeometry,
      Array(this.faceAmount).fill(AbstractAdapter.createOverlayMaterial())
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
    for (let i = 0; i < this.faceAmount; i++) {
      if (textureData.texture[i]) {
        const material = AbstractAdapter.createOverlayMaterial();
        material.uniforms.panorama.value = textureData.texture[i];
        //material.needsUpdate = true;
        mesh.material[i] = material;
      }
    }
    this.__refresh(); // immediately replace the low quality tiles from intial load
  }

  /**
   * @override
   */
  setTextureOpacity(mesh, opacity) {
    for (let i = 0; i < this.faceAmount; i++) {
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
        this.mesh.material[faceIdx].uniforms.panorama.value &&
        this.mesh.material[faceIdx].uniforms.panorama.value.userData.zoom > zoom &&
        !this.mesh.material[faceIdx].uniforms.panorama.value.userData.refreshing
      ) {
        this.mesh.material[faceIdx].uniforms.panorama.value.userData.refreshing = true;
        const oldUrl = this.mesh.material[faceIdx].uniforms.panorama.value.userData.url;
        this.__loadOneTexture(zoom, faceIdx).then((texture) => {
          if (this.mesh.material[faceIdx].uniforms.panorama.value.userData.url == oldUrl) {
            // ^ dumb temp fix to stop faces from loading in
            // after the user has already navigated to a different one
            const material = AbstractAdapter.createOverlayMaterial();
            material.uniforms.panorama.value = texture;
            material.userData.refreshing = false;
            this.mesh.material[faceIdx] = material;
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
