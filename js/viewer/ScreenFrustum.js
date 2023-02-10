import { Frustum, Matrix4 } from "three";

export class ScreenFrustum {
    constructor(psv) {
      this.psv = psv;
      this.frustum = new Frustum();
      this.projScreenMatrix = new Matrix4();
    }
  
    update(yaw=null) {
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
      const rotation = yaw ?? this.#getCurrentNorthOffset();
      this.projScreenMatrix.multiplyMatrices(
        this.projScreenMatrix,
        new Matrix4().makeRotationY(rotation)
      );
      this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    }
  
    #getCurrentNorthOffset() {
      return this.psv.panWorkaround ?? this.psv.config.sphereCorrection.pan;
    }
  }
