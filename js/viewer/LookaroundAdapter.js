import { Mesh, SphereGeometry, Vector3, ShaderMaterial, GLSL3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { CONSTANTS, utils, AbstractAdapter } from "@photo-sphere-viewer/core";

import { ScreenFrustum } from "./ScreenFrustum.js";
import { Face, ImageFormat } from "../enums.js";
import { isHeicSupported } from "../util/media.js";

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
    this.apiBaseUrl = psv.config.panoData.apiBaseUrl;
    this.navigationCrossfadeDisablesPanning =
      psv.config.panoData.navigationCrossfadeDisablesPanning;
    this.navigationCrossfadeDuration =
      psv.config.panoData.navigationCrossfadeDuration;
    this.upgradeCrossfadeDuration =
      psv.config.panoData.upgradeCrossfadeDuration;
    this.panorama = psv.config.panorama.panorama;
    this.url = psv.config.panorama.panorama.url;
    this.previousFovH = this.panorama.cameraMetadata[0].fovH;

    psv.addEventListener("position-updated", this);
    psv.addEventListener("zoom-updated", this);
    psv.addEventListener("before-rotate", this);
    psv.addEventListener("before-render", this);

    this.screenFrustum = new ScreenFrustum(psv);

    this.dynamicLoadingEnabled = true;

    this.timestamp = 0;

    this.hasNativeHeicSupport = null;
    this.heicWorker = new Worker("/static/dist/heicWorker.js");
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
      promises.push(this.#loadOneTexture(startZoom, i, progress));
    }
    return Promise.all(promises).then((texture) => {
      // if this pano has different camera paremeters from the last one, the mesh needs to be rebuilt.
      this.#recreateMeshIfNecessary();
      return { panorama: panoramaMetadata, texture };
    });
  }

  async #loadOneTexture(zoom, faceIdx, progress = null) {
    if (this.hasNativeHeicSupport === null) {
      this.hasNativeHeicSupport = await isHeicSupported();
    }

    let faceUrl = `${this.apiBaseUrl}${this.url}${zoom}/${faceIdx}/`;

    if (this.imageFormat === ImageFormat.JPEG || this.hasNativeHeicSupport) {
      if (this.hasNativeHeicSupport) {
        faceUrl += "?format=heic";
      }
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
          const img = await this.psv.textureLoader.blobToImage(file);
          const texture = utils.createTexture(img);
          texture.userData = { zoom: zoom, url: this.url };
          return texture;
        });
    } else {
      const data = await this.#fetchHeicAsRgbArray(faceUrl);
  
      const canvas = document.createElement("canvas");
      canvas.width = data.width;
      canvas.height = data.height;
      const context = canvas.getContext("2d");
      const imageData = new ImageData(data.buffer, canvas.width, canvas.height);
      context.putImageData(imageData, 0, 0);
  
      const texture = utils.createTexture(canvas);
      texture.userData = { zoom: zoom, url: this.url };
      this.psv.loader.setProgress(1); // TODO
      return texture;
    }
  }

  async #fetchHeicAsRgbArray(faceUrl) {
    return new Promise((res, rej) => {
      const channel = new MessageChannel();

      channel.port1.onmessage = ({ data }) => {
        channel.port1.close();
        if (data.error) {
          rej(data.error);
        } else {
          res(data.data);
        }
      };

      const data = { url: faceUrl };
      this.heicWorker.postMessage(data, [channel.port2]);
    });
  }

  #recreateMeshIfNecessary() {
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
        phiStart:
          this.panorama.cameraMetadata[i].yaw -
          this.panorama.cameraMetadata[i].fovS / 2 -
          Math.PI / 2,
        phiLength: this.panorama.cameraMetadata[i].fovS,
        thetaStart:
          Math.PI / 2 -
          this.panorama.cameraMetadata[i].fovH / 2 -
          this.panorama.cameraMetadata[i].cy,
        thetaLength: this.panorama.cameraMetadata[i].fovH,
      });

      if (i > 0 && i < Face.Top) {
        let overlap =
          params[i - 1].phiStart + params[i - 1].phiLength - params[i].phiStart;
        params[i - 1].phiLength -= overlap;
      }

      const faceGeom = new SphereGeometry(
        radius,
        24,
        32,
        params[i].phiStart,
        params[i].phiLength,
        params[i].thetaStart,
        params[i].thetaLength
      ).scale(-1, 1, 1);

      if (i === Face.Top || i === Face.Bottom) {
        faceGeom.rotateX(-this.panorama.cameraMetadata[i].pitch);
        faceGeom.rotateZ(-this.panorama.cameraMetadata[i].roll);
      }

      geometries.push(faceGeom);
      this.meshesForFrustum.push(new Mesh(faceGeom, []));
    }

    const mergedGeometry = mergeGeometries(geometries, true);
    const mesh = new Mesh(mergedGeometry, this.#createPanoFaceMaterials());
    this.mesh = mesh;
    return mesh;
  }

  /**
   * @override
   */
  setTexture(mesh, textureData) {
    this.#doMovementCrossfade();

    for (let i = 0; i < NUM_FACES; i++) {
      if (textureData.texture[i]) {
        mesh.material[i].uniforms.texture1.value = textureData.texture[i];
      }
    }
    // immediately replace the low quality tiles from intial load
    this.refresh();
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

  disposeMesh(mesh) {}

  /**
   * @private
   */
  handleEvent(e) {
    switch (e.type) {
      case "before-rotate":
        this.refresh();
        break;
      case "zoom-updated":
        this.refresh();
        break;
      case "before-render":
        this.#onBeforeRender(e);
        break;
    }
  }

  #onBeforeRender(e) {
    const elapsed = e.timestamp - this.timestamp;
    this.timestamp = e.timestamp;

    let needsUpdate = false;
    for (let i = 0; i < NUM_FACES; i++) {
      const mat = this.mesh.material[i];
      if (mat.uniforms.mixAmount.active) {
        needsUpdate = true;
        if (mat.uniforms.mixAmount.elapsed > this.upgradeCrossfadeDuration) {
          mat.uniforms.mixAmount.active = false;
          mat.uniforms.mixAmount.value = 0;
          mat.uniforms.mixAmount.elapsed = 0;
        } else {
          mat.uniforms.mixAmount.value =
            1 - mat.uniforms.mixAmount.elapsed / this.upgradeCrossfadeDuration;
          mat.uniforms.mixAmount.elapsed += elapsed;
        }
      }
    }

    if (needsUpdate) this.psv.needsUpdate();
  }

  refresh() {
    if (!this.mesh) return;
    if (this.mesh.material.length === 0) return;
    if (!this.dynamicLoadingEnabled) return;

    const visibleFaces = this.#getVisibleFaces();
    // TODO finetune this
    if (this.psv.renderer.state.vFov < 55) {
      this.#refreshFaces(visibleFaces, 0);
    } else {
      this.#refreshFaces(visibleFaces, 2);
    }
  }

  #refreshFaces(faces, zoom) {
    for (const faceIdx of faces) {
      const mat = this.mesh.material[faceIdx];
      if (
        mat.uniforms.texture1.value &&
        mat.uniforms.texture1.value.userData.zoom > zoom &&
        !mat.uniforms.texture1.value.userData.refreshing
      ) {
        mat.uniforms.texture1.value.userData.refreshing = true;
        const oldUrl = mat.uniforms.texture1.value.userData.url;
        this.#loadOneTexture(zoom, faceIdx).then((texture) => {
          if (mat.uniforms.texture1.value.userData.url == oldUrl) {
            // ^ dumb temp fix to stop faces from loading in
            // after the user has already navigated to a different panorama
            this.#blendTexture(mat, texture);
            this.psv.needsUpdate();
          }
        });
      }
    }
  }

  #blendTexture(mat, newTexture) {
    mat.uniforms.mixAmount.value = 1;
    mat.uniforms.mixAmount.active = true;
    mat.uniforms.texture2.value = mat.uniforms.texture1.value;
    mat.uniforms.texture1.value = newTexture;
    mat.uniforms.texture1.userData.refreshing = false;
  }

  #createPanoFaceMaterials() {
    const materials = Array(NUM_FACES);
    for (let i = 0; i < NUM_FACES; i++) {
      const material = this.#createCrossfadeMaterial();
      material.polygonOffset = true;
      material.polygonOffsetUnit = 1;
      material.polygonOffsetFactor = i * 2;
      materials[i] = material;
    }
    return materials;
  }

  #createCrossfadeMaterial() {
    return new ShaderMaterial({
      vertexShader: `
        out vec2 vTexCoord;
        
        void main() {
            vTexCoord = uv;   
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        in vec2 vTexCoord;
        
        uniform sampler2D texture1;
        uniform sampler2D texture2;
                
        uniform float mixAmount;
        
        out vec4 FragColor;
        
        void main() {        
            vec4 color1 = texture(texture1, vTexCoord);
            vec4 color2 = texture(texture2, vTexCoord);          
            FragColor = mix(color1, color2, mixAmount);
        }
      `,
      uniforms: {
        texture1: { value: null, userData: {} },
        texture2: { value: null, userData: {} },
        mixAmount: { value: 0.0, elapsed: 0.0, active: false },
      },
      glslVersion: GLSL3,
    });
  }

  #getVisibleFaces() {
    this.screenFrustum.update(this.panorama.heading);

    // TODO find a more elegant way to do this
    let point = new Vector3();
    const visibleFaces = [];
    for (let meshIdx = 0; meshIdx < this.meshesForFrustum.length; meshIdx++) {
      const mesh = this.meshesForFrustum[meshIdx];
      mesh.updateMatrixWorld();
      const position = mesh.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i);
        if (this.screenFrustum.frustum.containsPoint(point)) {
          visibleFaces.push(meshIdx);
          break;
        }
      }
    }
    return visibleFaces;
  }

  #doMovementCrossfade() {
    if (this.navigationCrossfadeDuration < 1) return;

    const psvCanvas = document.querySelector(".psv-canvas");
    if (!psvCanvas) return;

    const crossfadeCanvas = document.querySelector("#crossfade-canvas");
    crossfadeCanvas.width = psvCanvas.clientWidth;
    crossfadeCanvas.height = psvCanvas.clientHeight;
    crossfadeCanvas.style.display = "block";
    const ctx = crossfadeCanvas.getContext("2d");
    ctx.clearRect(0, 0, crossfadeCanvas.width, crossfadeCanvas.height);
    crossfadeCanvas.style.opacity = 1;
    ctx.drawImage(
      psvCanvas,
      0,
      0,
      crossfadeCanvas.width,
      crossfadeCanvas.height
    );
    const prevMoveSpeed = this.psv.config.moveSpeed;
    if (this.navigationCrossfadeDisablesPanning) {
      this.psv.setOption("moveSpeed", 0);
    }
    const animStart = new Date().valueOf();
    const interval = setInterval(() => {
      let elapsed = new Date().valueOf() - animStart;
      if (elapsed > this.navigationCrossfadeDuration) {
        crossfadeCanvas.style.display = "none";
        this.psv.setOption("moveSpeed", prevMoveSpeed);
        return clearInterval(interval);
      }
      crossfadeCanvas.style.opacity =
        1 - elapsed / this.navigationCrossfadeDuration;
    }, 16.6666);
  }
}
