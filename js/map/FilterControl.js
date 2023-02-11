import { LineColorType } from "../enums.js";

import Control from 'ol/control/Control.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Event from "ol/events/Event.js";
import Crop from "ol-ext/filter/Crop.js";
import { FilterSettings } from "./FilterSettings";

class FilterControl extends Control {
  #filterSettings = new FilterSettings();

  constructor(opt_options) {
    const options = opt_options || {};

    const parent = document.createElement("div");

    super({
      element: parent,
      target: options.target,
    });

    const menu = this.#setUpControls(parent);
    menu.querySelector("#filter-date").checked = false;
    menu.querySelector("#filter-date").addEventListener("change", (e) => {
      this.#filterSettings.filterByDate = e.target.checked;
      this.#filtersChanged();
    });
    menu.querySelector("#coverage-min-date").addEventListener("blur", (e) => {
      this.#filterSettings.minDate = Math.floor(
        new Date(menu.querySelector("#coverage-min-date").value).getTime()
      );
      this.#filtersChanged();
    });
    menu.querySelector("#coverage-max-date").addEventListener("blur", (e) => {
      this.#filterSettings.maxDate = Math.floor(
        new Date(menu.querySelector("#coverage-max-date").value).getTime()
      );
      this.#filtersChanged();
    });

    menu.querySelector("#show-cars").checked = true;
    menu.querySelector("#show-cars").addEventListener("change", (e) => {
      this.#filterSettings.showCars = e.target.checked;
      this.#filtersChanged();
    });
    menu.querySelector("#show-trekkers").checked = true;
    menu.querySelector("#show-trekkers").addEventListener("change", (e) => {
      this.#filterSettings.showTrekkers = e.target.checked;
      this.#filtersChanged();
    });

    menu.querySelector("#color-by-type").addEventListener("change", (e) => {
      this.#filterSettings.lineColorType = LineColorType.CoverageType;
      this.#filtersChanged();
    });
    menu.querySelector("#color-by-age").addEventListener("change", (e) => {
      this.#filterSettings.lineColorType = LineColorType.Age;
      this.#filtersChanged();
    });

    menu.querySelector("#polygon-filter").addEventListener("change", (e) => { 
      this.#polygonSelected(e); 
      menu.querySelector("#remove-polygon-filter").style.display = "inline";
    }, false);
    menu.querySelector("#remove-polygon-filter").addEventListener("click", (e) => {
      this.#filterSettings.polygonFilter = null;
      e.target.style.display = "none";
      this.#filtersChanged();
    });
  }

  #polygonSelected(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.addEventListener("load", (e) => {
      const geoJson = new GeoJSON();
      const features = geoJson.readFeatures(e.target.result, {
        featureProjection: "EPSG:3857",
      });
      const crop = new Crop({
        feature: features[0],
        wrapX: true,
        inner: false,
      });
      this.#filterSettings.polygonFilter = crop;
      this.#filtersChanged();
    });
    reader.readAsText(file);
  }

  getFilterSettings() {
    return this.#filterSettings;
  }

  #filtersChanged() {
    this.dispatchEvent(new FilterControlEvent("changed", this.#filterSettings));
  }

  #setUpControls(parent) {
    const element = document.createElement("div");
    element.className = "filter-control ol-unselectable ol-control";
    parent.appendChild(element);

    const button = document.createElement("button");
    element.appendChild(button);

    const menu = document.createElement("div");
    menu.className = "filter-control-menu";
    // TODO unfuck this
    menu.innerHTML = `
    <div class="filter-control-menu-container">
    <div class="filter-control-group">
    <h2>Coverage type</h2>
    <input type="checkbox" id="show-cars" name="show-cars" checked><label for="show-cars">Show car footage</label><br>
    <input type="checkbox" id="show-trekkers" name="show-trekkers" checked><label for="show-trekkers">Show trekker
      footage</label>
    </div>
    <div class="filter-control-group">
    <h2>Capture date</h2>
    <input type="checkbox" id="filter-date" name="filter-date"><label for="filter-date">Filter by date:</label>
    <table>
      <tr>
        <td>From:</td>
        <td><input type="date" id="coverage-min-date" name="coverage-min-date" value="2018-01-01"></td>
      </tr>
      <tr>
        <td>To:</td>
        <td><input type="date" id="coverage-max-date" name="coverage-max-date" value="2023-01-01"></td>
      </tr>
    </table>
    </div>
    <div class="filter-control-group">
    <h2>Color</h2>
      <input type="radio" id="color-by-type" name="line-color" checked><label for="color-by-type">Color by coverage type</label><br>
      <input type="radio" id="color-by-age" name="line-color"><label for="color-by-age">Color by age</label>
    </div>
    <div class="filter-control-group">
    <h2>Crop by GeoJSON polygon</h2>
      <input type="file" id="polygon-filter" />
      <button id="remove-polygon-filter" style="display:none;">✕</button>
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

export class FilterControlEvent extends Event {
  constructor(type, filterSettings) {
    super(type);
    this.filterSettings = filterSettings;
  }
}
export { FilterControl };
