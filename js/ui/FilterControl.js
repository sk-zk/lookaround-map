import { LineColorType } from "../enums.js";
import { FilterSettings } from "../map/FilterSettings.js";

import GeoJSON from 'ol/format/GeoJSON.js';
import Event from "ol/events/Event.js";
import Crop from "ol-ext/filter/Crop.js";

export class FilterControl {
  #filterSettings = new FilterSettings();
  filtersChanged = function(filters) {};

  constructor() {
    document.querySelector("#filter-date").checked = false;
    document.querySelector("#filter-date").addEventListener("change", (e) => {
      this.#filterSettings.filterByDate = e.target.checked;
      this.onFiltersChanged();
    });
    document.querySelector("#coverage-min-date").addEventListener("blur", (e) => {
      this.#filterSettings.minDate = Math.floor(
        new Date(document.querySelector("#coverage-min-date").value).getTime()
      );
      this.onFiltersChanged();
    });
    document.querySelector("#coverage-max-date").addEventListener("blur", (e) => {
      this.#filterSettings.maxDate = Math.floor(
        new Date(document.querySelector("#coverage-max-date").value).getTime()
      );
      this.onFiltersChanged();
    });

    document.querySelector("#show-cars").checked = true;
    document.querySelector("#show-cars").addEventListener("change", (e) => {
      this.#filterSettings.showCars = e.target.checked;
      this.onFiltersChanged();
    });
    document.querySelector("#show-trekkers").checked = true;
    document.querySelector("#show-trekkers").addEventListener("change", (e) => {
      this.#filterSettings.showTrekkers = e.target.checked;
      this.onFiltersChanged();
    });

    document.querySelector("#color-by-type").addEventListener("change", (e) => {
      this.#filterSettings.lineColorType = LineColorType.CoverageType;
      this.onFiltersChanged();
    });
    document.querySelector("#color-by-age").addEventListener("change", (e) => {
      this.#filterSettings.lineColorType = LineColorType.Age;
      this.onFiltersChanged();
    });

    document.querySelector("#polygon-filter").addEventListener("change", (e) => { 
      this.#polygonSelected(e); 
      document.querySelector("#remove-polygon-filter").style.display = "inline";
    }, false);
    document.querySelector("#remove-polygon-filter").addEventListener("click", (e) => {
      this.#filterSettings.polygonFilter = null;
      e.target.style.display = "none";
      this.onFiltersChanged();
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
      this.onFiltersChanged();
    });
    reader.readAsText(file);
  }

  getFilterSettings() {
    return this.#filterSettings;
  }

  onFiltersChanged() {
    this.filtersChanged(this.#filterSettings);
  }
}

export class FilterControlEvent extends Event {
  constructor(type, filterSettings) {
    super(type);
    this.filterSettings = filterSettings;
  }
}
