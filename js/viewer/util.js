export class ScreenFrustum {
    constructor(psv) {
      this.psv = psv;
      this.frustum = new THREE.Frustum();
      this.projScreenMatrix = new THREE.Matrix4();
    }
  
    update(longitude=null) {
      const camera = this.psv.renderer.camera;
      camera.updateMatrix();
      camera.updateMatrixWorld();
      this.projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      // for some reason, psv.config.sphereCorrection doesn't get updated when
      // a new pano is loaded, so I worked around it by just making the caller
      // write it into a field on the viewer
      const rotation = longitude ?? this.#getCurrentNorthOffset();
      this.projScreenMatrix.multiplyMatrices(
        this.projScreenMatrix,
        new THREE.Matrix4().makeRotationY(rotation)
      );
      this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    }
  
    #getCurrentNorthOffset() {
      return this.psv.panWorkaround ?? this.psv.config.sphereCorrection.pan;
    }
  }
  