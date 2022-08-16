import "/static/BufferGeometryUtils.js";

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

const Mesh = THREE.Mesh;
const MeshBasicMaterial = THREE.MeshBasicMaterial;
const SphereGeometry = THREE.SphereGeometry;

const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();
const vertexPosition = new THREE.Vector3();

/**
 * @summary Adapter for Look Around panoramas
 * @memberof PSV.adapters
 * @extends PSV.adapters.AbstractAdapter
 */
export class LookaroundAdapter extends PhotoSphereViewer.AbstractAdapter {
  static id = "lookaround";
  static supportsDownload = true;

  /**
   * @param {PSV.Viewer} psv
   */
  constructor(psv) {
    super(psv);

    // base url of the panorama without face and zoom params, e.g. /pano/10310324438691663065/1086517344/.
    // gets set in loadTexture().
    this.url = null;

    this.config = {
      resolution: 64,
    };

    this.SPHERE_SEGMENTS = this.config.resolution;
    this.SPHERE_HORIZONTAL_SEGMENTS = this.SPHERE_SEGMENTS / 2;

    this.psv.on(PhotoSphereViewer.CONSTANTS.EVENTS.POSITION_UPDATED, this);
    this.psv.on(PhotoSphereViewer.CONSTANTS.EVENTS.ZOOM_UPDATED, this);
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
   * @param {string} panorama
   * @returns {Promise.<PSV.TextureData>}
   */
  loadTexture(panorama) {
    // initial load of the pano with a low starting quality.
    // higher resolution faces are loaded dynamically based on zoom level
    // and where the user is looking.
    const promises = [];
    const progress = [0, 0, 0, 0, 0, 0];
    const startZoom = 4;
    this.url = panorama;
    for (let i = 0; i < 6; i++) {
      promises.push(this.__loadOneTexture(startZoom, i, progress));
    }
    return Promise.all(promises).then((texture) => ({ panorama, texture }));
  }

  async __loadOneTexture(zoom, faceIdx, progress = null) {
    const faceUrl = this.url + `${zoom}/${faceIdx}/`;
    return await this.psv.textureLoader
      .loadImage(faceUrl, (p) => {
        if (progress) {
          progress[faceIdx] = p;
          this.psv.loader.setProgress(
            PhotoSphereViewer.utils.sum(progress) / 6
          );
        }
      })
      .then((img) => {
        // TODO handle overlap with UVs rather than cropping the image
        let texture = null;
        if (faceIdx < 4) {
          const buffer = this.__cropSideFace(img, zoom);
          texture = PhotoSphereViewer.utils.createTexture(buffer);
        } else {
          texture = PhotoSphereViewer.utils.createTexture(img);
        }
        texture.userData = { zoom: zoom, url: this.url };
        return texture;
      });
  }

  __cropSideFace(img, zoom) {
    // TODO do this in a less idiotic way
    const overlap = [256, 188, 100, 71, 50, 36, 25, 18][zoom];

    const buffer = document.createElement("canvas");
    buffer.width = img.naturalWidth - overlap;
    buffer.height = img.naturalHeight;

    const ctx = buffer.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return buffer;
  }

  /**
   * @override
   */
  createMesh(scale = 1) {
    // TODO set the correct width/height segments value to get a uniform sphere
    // rather than just using the same val for every face
    const faces = [
      // radius, widthSegments, heightSegments,
      // phiStart, phiLength, thetaStart, thetaLength
      [
        PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale,
        this.SPHERE_SEGMENTS,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(0),
        degToRad(120),
        degToRad(28),
        degToRad(92.5),
      ],
      [
        PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale,
        this.SPHERE_SEGMENTS,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(120),
        degToRad(60),
        degToRad(28),
        degToRad(92.5),
      ],
      [
        PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale,
        this.SPHERE_SEGMENTS,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(180),
        degToRad(120),
        degToRad(28),
        degToRad(92.5),
      ],
      [
        PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale,
        this.SPHERE_SEGMENTS,
        this.SPHERE_HORIZONTAL_SEGMENTS,
        degToRad(300),
        degToRad(60),
        degToRad(28),
        degToRad(92.5),
      ],
      //[PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale, this.SPHERE_SEGMENTS, this.SPHERE_HORIZONTAL_SEGMENTS, degToRad(0), degToRad(360), degToRad(0), degToRad(28)],
      //[PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale, this.SPHERE_SEGMENTS, this.SPHERE_HORIZONTAL_SEGMENTS, degToRad(0), degToRad(360), degToRad(28+92.5), degToRad(59.5)],
    ];
    const geometries = [];
    this.meshesForFrustum = [];
    for (let i = 0; i < faces.length; i++) {
      const geom = new SphereGeometry(...faces[i]).scale(-1, 1, 1);
      geometries.push(geom);
      this.meshesForFrustum.push(new Mesh(geom, []));
    }

    const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(
      geometries,
      true
    );
    const mesh = new Mesh(
      mergedGeometry,
      Array(6).fill(new MeshBasicMaterial())
    );
    this.mesh = mesh;
    return mesh;
  }

  /**
   * @override
   */
  setTexture(mesh, textureData) {
    for (let i = 0; i < 6; i++) {
      mesh.material[i] = new MeshBasicMaterial({ map: textureData.texture[i] });
    }
    this.__refresh(); // immediately replace the low quality tiles from intial load
  }

  /**
   * @override
   */
  setTextureOpacity(mesh, opacity) {
    for (let i = 0; i < 6; i++) {
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
      case PhotoSphereViewer.CONSTANTS.EVENTS.POSITION_UPDATED:
      case PhotoSphereViewer.CONSTANTS.EVENTS.ZOOM_UPDATED:
        this.__refresh();
        break;
    }
  }

  __refresh() {
    if (!this.mesh) return;
    if (this.mesh.material.length === 0) return;

    const visibleFaces = this.__getVisibleFaces();
    // TODO finetune this
    if (this.psv.renderer.prop.vFov < 55) {
      this.__refreshFaces(visibleFaces, 0);
    } else {
      this.__refreshFaces(visibleFaces, 2);
    }
  }

  __refreshFaces(faces, zoom) {
    for (let faceIdx of faces) {
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

  __getVisibleFaces() {
    const camera = this.psv.renderer.camera;
    camera.updateMatrix();
    camera.updateMatrixWorld();
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // TODO find a more elegant way to do this
    const visibleFaces = [];
    for (let meshIdx = 0; meshIdx < this.meshesForFrustum.length; meshIdx++) {
      const mesh = this.meshesForFrustum[meshIdx];
      const position = mesh.geometry.getAttribute("position");
      const step = 50;
      for (let i = 0; i < position.count; i += step) {
        const point = new THREE.Vector3().fromBufferAttribute(position, i);
        if (frustum.containsPoint(point)) {
          visibleFaces.push(meshIdx);
          break;
        }
      }
    }
    return visibleFaces;
  }
}
