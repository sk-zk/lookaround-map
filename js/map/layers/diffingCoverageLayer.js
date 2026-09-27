import { FilterSettings } from "../FilterSettings.js";
import { Constants } from "../Constants.js";
import { getDevicePixelRatioAsInt } from "../../util/misc.js";

import XYZ from "ol/source/XYZ.js";
import TileLayer from "ol/layer/Tile.js";

const pixelRatio = getDevicePixelRatioAsInt();

class DiffingCoverageLayer extends TileLayer {
  #filterSettings = new FilterSettings();
  #historicalSettings;
  #currentPolygonFilter;

  constructor() {
    super({
      visible: true,
      type: "overlay",
      source: new XYZ({
        minZoom: Constants.MIN_ZOOM-1,
        maxZoom: Constants.MAX_ZOOM,
        tilePixelRatio: Math.min(2, pixelRatio)
      }),
      minZoom: Constants.MIN_ZOOM-1,
      maxZoom: Constants.MAX_ZOOM,
      opacity: Constants.LINE_OPACITY,
      zIndex: Constants.BLUE_LINES_ZINDEX,
    });
  }

  setFilterSettings(filterSettings) {
    this.#filterSettings = filterSettings;
    this.#setPolygonFilter();
    this.#updateUrl();
  }

  #setPolygonFilter() {
    this.removeFilter(this.#currentPolygonFilter);
    this.#currentPolygonFilter = this.#filterSettings.polygonFilter;
    if (this.#currentPolygonFilter != null) {
      this.addFilter(this.#filterSettings.polygonFilter);
    }
  } 

  setHistoricalSettings(settings) {
    this.#historicalSettings = settings;
    this.#updateUrl();
  }

  #updateUrl() {
    this.getSource().setUrl(this.generateUrl(this.#filterSettings, this.#historicalSettings));
  }

  generateUrl(filterSettings, historicalSettings) {
    const baseUrl = "https://boskop.skzk.dev/difference/{z}/{x}/{y}/";
    //const baseUrl = "http://localhost:5171/difference/{z}/{x}/{y}/";
    const params = new URLSearchParams();
    if (pixelRatio > 1) {
      params.append("scale", pixelRatio);
    }
    if (historicalSettings.dateA) {
      const dateA = Math.floor(historicalSettings.dateA / 1000);
      params.append("a", dateA);
    }
    if (historicalSettings.dateB) {
      const dateB = Math.floor(historicalSettings.dateB / 1000);
      params.append("b", dateB);
    }
    if (filterSettings.filterByDate) {
      const minDate = Math.floor(filterSettings.minDate / 1000);
      params.append("min", minDate);
      const maxDate = Math.floor(filterSettings.maxDate / 1000);
      params.append("max", maxDate);
    }
    if (filterSettings.showCars === false) {
      params.append("car", "false");
    }
    if (filterSettings.showTrekkers === false) {
      params.append("backpack", "false");
    }
    return baseUrl + "?" + params;
  }
}
const diffingCoverageLayer = new DiffingCoverageLayer();

export { diffingCoverageLayer };