import { LineColorType } from "../enums.js";
import { FilterSettings } from "../map/FilterSettings.js";

import GeoJSON from "ol/format/GeoJSON.js";
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
    const coverageMinDate = document.querySelector("#coverage-min-date");
    coverageMinDate.value = new Date(this.#filterSettings.minDate).toISOString().split("T")[0];
    coverageMinDate.addEventListener("blur", (_) => {
      this.#filterSettings.minDate = Math.floor(
        new Date(document.querySelector("#coverage-min-date").value).getTime()
      );
      if (this.#filterSettings.filterByDate) {
        this.onFiltersChanged();
      }
    });
    const coverageMaxDate = document.querySelector("#coverage-max-date");
    coverageMaxDate.value = new Date(this.#filterSettings.maxDate).toISOString().split("T")[0];
    coverageMaxDate.addEventListener("blur", (_) => {
      this.#filterSettings.maxDate = Math.floor(
        new Date(document.querySelector("#coverage-max-date").value).getTime()
      );
      if (this.#filterSettings.filterByDate) {
        this.onFiltersChanged();
      }
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

    document.querySelector("#color-by-type").addEventListener("change", (_) => {
      this.#filterSettings.lineColorType = LineColorType.CoverageType;
      this.onFiltersChanged();
    });
    document.querySelector("#color-by-age").addEventListener("change", (_) => {
      this.#filterSettings.lineColorType = LineColorType.Age;
      this.onFiltersChanged();
    });
    document.querySelector("#color-by-build-id").addEventListener("change", (_) => {
      this.#filterSettings.lineColorType = LineColorType.BuildId;
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

    document.querySelector("#filter-build-id").addEventListener("change", (e) => {
      this.#filterSettings.filterByBuildId = e.target.checked;
      this.onFiltersChanged();
    });

    document.querySelector("#filter-build-id-val").addEventListener("change", (e) => {
      if (e.target.checkValidity()) {
        this.#filterSettings.buildId = e.target.value;
      } else {
        this.#filterSettings.buildId = null;
      }
      if (this.#filterSettings.filterByBuildId) {
        this.onFiltersChanged();
      }
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
