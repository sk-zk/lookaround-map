import Control from "ol/control/Control.js";

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
        <h2>Settings</h2>
        <input type="checkbox" id="show-full-pano" name="show-full-pano"><label for="show-full-pano">Render full panorama (experimental)</label>
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
