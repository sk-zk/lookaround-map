import { Control } from "ol/control.js";

class GeolocationButton extends Control {
  constructor(options) {
    options = options || {};

    const button = document.createElement("button");
    const element = document.createElement("div");
    element.className = "geolocate ol-unselectable ol-control";
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener("click", this.geolocate.bind(this), false);
  }

  geolocate() {
    navigator.geolocation.getCurrentPosition((position) => {
      const view = this.getMap().getView();
      view.setCenter([position.coords.longitude, position.coords.latitude]);
      view.setZoom(19);
    });
  }
}

export { GeolocationButton };