import { Control } from "ol/control.js";

let theMap;

class GeolocationButton extends Control {
  #mapMgr;

  constructor(mapMgr, options) {
    options = options || {};

    const button = document.createElement("button");
    const element = document.createElement("div");
    element.className = "geolocate ol-unselectable ol-control";
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    this.#mapMgr = mapMgr;

    button.addEventListener("click", this.geolocate.bind(this), false);
  }

  geolocate() {
    navigator.geolocation.getCurrentPosition((position) => {    
      const coord = [position.coords.longitude, position.coords.latitude];
      this.#mapMgr.setMarkerPosition(coord);
      const view = this.#mapMgr.getMap().getView();
      view.setCenter(coord);
      view.setZoom(17);
    });
  }
}

export { GeolocationButton };