export function parseHashParams() {
    const params = new URLSearchParams(window.location.hash.substring(1));

    let center = null;
    if (params.has("c")) {
        const centerParams = params.get("c").split("/");
        center = { zoom: centerParams[0], latitude: centerParams[1], longitude: centerParams[2] };
    } else {
        center = { zoom: 3, latitude: 20, longitude: 0 };
    }

    let pano = null;
    if (params.has("p")) {
        const panoParams = params.get("p").split("/");
        pano = { latitude: panoParams[0], longitude: panoParams[1] };
    }

    return {
        "center": center,
        "pano": pano
    };
}

export class ScreenFrustum {
  constructor(psv) {
    this.psv = psv;
    this.frustum = new THREE.Frustum();
    this.projScreenMatrix = new THREE.Matrix4();
  }

  update() {
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
    const rotation = this.#getCurrentNorthOffset();
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
