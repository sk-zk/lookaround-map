import "/static/BufferGeometryUtils.js";

const Mesh = THREE.Mesh;
const MeshBasicMaterial = THREE.MeshBasicMaterial;
const SphereGeometry = THREE.SphereGeometry;

function degToRad(deg) {
  return deg * Math.PI / 180;
}

/**
 * @summary Adapter for equirectangular panoramas
 * @memberof PSV.adapters
 * @extends PSV.adapters.AbstractAdapter
 */
export class LookaroundAdapter extends PhotoSphereViewer.AbstractAdapter {
  static id = 'lookaround';
  static supportsDownload = true;

  /**
   * @param {PSV.Viewer} psv
   */
  constructor(psv) {
    super(psv);

    this.config = {
      resolution: 64,
    };

    this.SPHERE_SEGMENTS = this.config.resolution;
    this.SPHERE_HORIZONTAL_SEGMENTS = this.SPHERE_SEGMENTS / 2;
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
    const promises = [];
    const progress = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6; i++) {
      promises.push(
        this.psv.textureLoader.loadImage(panorama[i], (p) => {
          progress[i] = p;
          this.psv.loader.setProgress(PhotoSphereViewer.utils.sum(progress) / 6);
        })
          .then(img => {
            const buffer = document.createElement('canvas');
            buffer.width = img.naturalWidth - 71; // todo
            buffer.height = img.naturalHeight;

            const ctx = buffer.getContext('2d');
            ctx.drawImage(img, 0, 0);

            return PhotoSphereViewer.utils.createTexture(buffer);
          })
      );
    }

    return Promise.all(promises)
      .then(texture => ({ panorama, texture }));
  }

  /**
   * @override
   */
  createMesh(scale = 1) {
    // TODO set the correct width/height segments value to get a uniform sphere
    // rather than just using the same val for every face
    const faces = [
      // radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength
      [PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale, this.SPHERE_SEGMENTS, this.SPHERE_HORIZONTAL_SEGMENTS, degToRad(0), degToRad(120), degToRad(28), degToRad(92.5)],
      [PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale, this.SPHERE_SEGMENTS, this.SPHERE_HORIZONTAL_SEGMENTS, degToRad(120), degToRad(60), degToRad(28), degToRad(92.5)],
      [PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale, this.SPHERE_SEGMENTS, this.SPHERE_HORIZONTAL_SEGMENTS, degToRad(180), degToRad(120), degToRad(28), degToRad(92.5)],
      [PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale, this.SPHERE_SEGMENTS, this.SPHERE_HORIZONTAL_SEGMENTS, degToRad(300), degToRad(60), degToRad(28), degToRad(92.5)],
      //[PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale, this.SPHERE_SEGMENTS, this.SPHERE_HORIZONTAL_SEGMENTS, degToRad(0), degToRad(360), degToRad(0), degToRad(28)],
      //[PhotoSphereViewer.CONSTANTS.SPHERE_RADIUS * scale, this.SPHERE_SEGMENTS, this.SPHERE_HORIZONTAL_SEGMENTS, degToRad(0), degToRad(360), degToRad(28+92.5), degToRad(59.5)],
    ];
    const geometries = [];
    for (let i = 0; i < faces.length; i++) {
      geometries.push(new SphereGeometry(...faces[i]).scale(-1, 1, 1));
    }

    const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries, true);
    const mesh = new Mesh(mergedGeometry, []);
    return mesh;
  }

  /**
   * @override
   */
  setTexture(mesh, textureData) {
    for (let i = 0; i < 6; i++) {
      console.log(textureData.texture[i]);
      mesh.material.push(new MeshBasicMaterial({ map: textureData.texture[i] }));
    }
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
    textureData.texture?.forEach(texture => texture.dispose());
  }

}
