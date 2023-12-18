import { Group, Mesh, SphereGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { CONSTANTS, utils, AbstractAdapter } from "@photo-sphere-viewer/core"

import { ScreenFrustum } from "./ScreenFrustum.js";
import { Face, ImageFormat } from "../enums.js";
import { getFirstFrameOfVideo } from "../util/media.js";

const NUM_FACES = 6;

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

    this.imageFormat = psv.config.panoData.imageFormat;
    this.endpoint = psv.config.panoData.endpoint;

    this.panorama = psv.config.panorama.panorama;
    this.url = psv.config.panorama.panorama.url;
    this.previousFovH = this.panorama.cameraMetadata[0].fovH;

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

    // initial load of the pano with a low starting quality.
    // higher resolution faces are loaded dynamically based on zoom level
    // and where the user is looking.
    const promises = [];
    const progress = [0, 0, 0, 0, 0, 0];
    const startZoom = 5;
    for (let i = 0; i < NUM_FACES; i++) {
      promises.push(this.__loadOneTexture(startZoom, i, progress));
    }
    return Promise.all(promises).then((texture) => { 
      // if this pano has different camera paremeters from the last one, the mesh needs to be rebuilt.
      this.__recreateMeshIfNecessary();
      return { panorama: panoramaMetadata, texture };
    });
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
        // if HEVC is requested but heic2rgb is not installed in the backend,
        // JPEG will be returned instead, so let's double check what we
        // actually got
        let receivedFormat = this.imageFormat;
        if (this.imageFormat === ImageFormat.HEVC) {
          const bytes = new Uint8Array(await file.slice(0, 2).arrayBuffer());
          if (bytes[0] === 0xff && bytes[1] === 0xd8) {
            receivedFormat = ImageFormat.JPEG;
          }
        }

        let texture = null;
        if (receivedFormat === ImageFormat.HEVC) {
          const objectUrl = URL.createObjectURL(file);
          const frame = await getFirstFrameOfVideo(objectUrl, "video/mp4");
          texture = utils.createTexture(frame);
          URL.revokeObjectURL(objectUrl);
        } else {
          const img = await this.psv.textureLoader.blobToImage(file);
          texture = utils.createTexture(img);
        }

        texture.userData = { zoom: zoom, url: this.url };

        return texture;
      });
  }

  __recreateMeshIfNecessary() {   
    const fovH = this.panorama.cameraMetadata[0].fovH;
    if (this.previousFovH !== fovH) {
      const mesh = this.createMesh();
      mesh.userData = { ["photoSphereViewer"]: true };
      mesh.parent = this.psv.renderer.meshContainer;

      mesh.updateMatrixWorld(true);

      this.psv.renderer.mesh = mesh;
      const oldMesh = this.psv.renderer.meshContainer.children[0];
      this.psv.renderer.meshContainer.remove(oldMesh);
      this.psv.renderer.meshContainer.add(mesh);
    }
    this.previousFovH = fovH;
  }

  /**
   * @override
   */
  createMesh(scale = 1) {
    const radius = CONSTANTS.SPHERE_RADIUS * scale;

    const geometries = [];
    this.meshesForFrustum = [];
    const params = [];

    for (let i = 0; i < NUM_FACES; i++) {
      params.push({
        phiStart: this.panorama.cameraMetadata[i].yaw - (this.panorama.cameraMetadata[i].fovS / 2) - (Math.PI / 2),
        phiLength: this.panorama.cameraMetadata[i].fovS,
        thetaStart: (Math.PI / 2) - (this.panorama.cameraMetadata[i].fovH / 2) - this.panorama.cameraMetadata[i].cy,
        thetaLength: this.panorama.cameraMetadata[i].fovH,
      });
      
      const faceGeom = new SphereGeometry(
        radius, 24, 32, 
        params[i].phiStart, params[i].phiLength, params[i].thetaStart, params[i].thetaLength
      ).scale(-1, 1, 1);

      if (i === Face.Top || i === Face.Bottom) {
        faceGeom.rotateX(-this.panorama.cameraMetadata[i].pitch);
        faceGeom.rotateZ(-this.panorama.cameraMetadata[i].roll);
      }

      geometries.push(faceGeom);
      this.meshesForFrustum.push(new Mesh(faceGeom, []));
    }

    const mergedGeometry = mergeGeometries(geometries, true);
    const mesh = new Mesh(
      mergedGeometry,
      Array(NUM_FACES).fill(AbstractAdapter.createOverlayMaterial())
    );
    this.mesh = mesh;
    return mesh;
  }

  /**
   * @override
   */
  setTexture(mesh, textureData) {
    for (let i = 0; i < NUM_FACES; i++) {
      if (textureData.texture[i]) {
        const material = AbstractAdapter.createOverlayMaterial();
        material.polygonOffset = true;
        material.polygonOffsetUnit = 1;
        material.polygonOffsetFactor = i;
        material.uniforms.panorama.value = textureData.texture[i];
        mesh.material[i] = material;
      }
    }
    this.__refresh(); // immediately replace the low quality tiles from intial load
  }

  /**
   * @override
   */
  setTextureOpacity(mesh, opacity) {
    for (let i = 0; i < NUM_FACES; i++) {
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
            // after the user has already navigated to a different panorama
            const material = AbstractAdapter.createOverlayMaterial();
            material.polygonOffset = true;
            material.polygonOffsetUnit = 1;
            material.polygonOffsetFactor = faceIdx;
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
