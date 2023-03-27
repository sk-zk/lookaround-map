import Control from "ol/control/Control.js";
import { AddressSource } from "../enums.js";

export class SettingsControl extends Control {
  constructor(opt_options) {
    const options = opt_options || {};

    const parent = document.createElement("div");

    super({
      element: parent,
      target: options.target,
    });

    const menu = this.#setUpControls(parent);

    const showFullPano = menu.querySelector("#show-full-pano");
    showFullPano.checked = localStorage.getItem("showFullPano") === "true";
    showFullPano.addEventListener("change", (_) => localStorage.setItem("showFullPano", showFullPano.checked));

    const addrNominatim = menu.querySelector("#addr-nominatim");
    const addrApple = menu.querySelector("#addr-apple");
    switch (localStorage.getItem("addrSource")) {
      case AddressSource.Nominatim:
        addrNominatim.checked = true;
        break;
      case AddressSource.Apple:
      default:
        addrApple.checked = true;
        break;
    }
    addrNominatim.addEventListener("change", (_) => {
      localStorage.setItem("addrSource", AddressSource.Nominatim);
      this.#addressSourceChanged();
    })
    addrApple.addEventListener("change", (_) => {
      localStorage.setItem("addrSource", AddressSource.Apple);
      this.#addressSourceChanged();
    })
  }

  #addressSourceChanged() {
    this.dispatchEvent("addrSourceChanged");
  }

  #setUpControls(parent) {
    const container = document.createElement("div");
    container.className = "settings-control hover-control ol-unselectable ol-control";
    parent.appendChild(container);

    const button = document.createElement("button");
    container.appendChild(button);

    const menu = document.createElement("div");
    menu.className = "settings-control-menu hover-control-menu";
    menu.innerHTML = `
        <div class="hover-control-menu-container">
        <div class="hover-control-group">
          <h2>Renderer</h2>
          <input type="checkbox" id="show-full-pano" name="show-full-pano"><label for="show-full-pano">Render full panorama (experimental)</label>
        </div>
        <div class="hover-control-group">
          <h2>Address source</h2>
          <input type="radio" id="addr-nominatim" name="addr"><label for="addr-nominatim">OpenStreetMap (Nominatim)</label><br>
          <input type="radio" id="addr-apple" name="addr"><label for="addr-apple">Apple</label>
        </div>
        </div>
        `;
    parent.appendChild(menu);

    button.addEventListener("mouseover", (e) => {
      button.style.display = "none";
      menu.style.display = "block";
    });
    menu.addEventListener("mouseleave", (e) => {
      button.style.display = "block";
      menu.style.display = "none";
    });

    return menu;
  }
}
