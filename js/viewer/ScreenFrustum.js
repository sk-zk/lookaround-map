import { Frustum, Matrix4 } from "three";

export class ScreenFrustum {
    constructor(psv) {
      this.psv = psv;
      this.frustum = new Frustum();
      this.projScreenMatrix = new Matrix4();
    }
  
    update(yaw) {
      const camera = this.psv.renderer.camera;
      camera.updateMatrix();
      camera.updateMatrixWorld();
      this.projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      this.projScreenMatrix.multiplyMatrices(
        this.projScreenMatrix,
        new Matrix4().makeRotationY(yaw)
      );
      this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    }

  }
