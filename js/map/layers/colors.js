import { LineColorType, CoverageType } from "../../enums.js";
import { FilterSettings } from "../FilterSettings.js";

import { interpolateTurbo } from "d3-scale-chromatic";

const earliestDate = Math.floor(new Date("2018-06-01").getTime());
const latestDate =   Math.floor(new Date("2023-09-01").getTime());

const carLineColor = "rgba(26, 159, 176, 1)";
const trekkerLineColor = "rgba(173, 140, 191, 1)";

function createValueToPercentFunction(start, end) {
  let range = end - start;
  return (n) => (n - start) / range;
}

function offsetTurbo(n) {
  return 0.5 - n + 0.5;
}

function circlesOnly(lineColorType) {
  return lineColorType === LineColorType.BuildId;
}

class CoverageColorer {
  #filterSettings = new FilterSettings();

  constructor() {
    this.coverageTypeFunction = 
      (metadata) => metadata.coverageType === CoverageType.Car ? carLineColor : trekkerLineColor;
    this.colorFunction = this.coverageTypeFunction;
  }

  determineLineColor(metadata) {
    if (circlesOnly(this.#filterSettings.lineColorType)) {
      return this.coverageTypeFunction(metadata);
    }
    return this.colorFunction(metadata);
  }

  determineCircleColor(metadata) {
    return this.colorFunction(metadata);
  }

  filterSettingsChanged(filterSettings) {
    this.#filterSettings = filterSettings;
    if (filterSettings.lineColorType === LineColorType.CoverageType) {
      this.colorFunction = this.coverageTypeFunction;
    } else if (filterSettings.lineColorType === LineColorType.Age) {
      let start;
      let end;
      if (filterSettings.filterByDate) {
        start = filterSettings.minDate;
        end = filterSettings.maxDate;
      } else {
        start = earliestDate;
        end = latestDate;
      }
      const convFn = createValueToPercentFunction(start, end);
      const offsetFn = offsetTurbo;
      const interpFn = interpolateTurbo;
      this.colorFunction = (metadata) => interpFn(offsetFn(convFn(metadata.timestamp)));
    } else if (filterSettings.lineColorType === LineColorType.BuildId) {
      const start = 511228947; // lowest value discovered since I started scraping
      const end = 2000000000; // highest value plus some breathing room
      const convFn = createValueToPercentFunction(start, end);
      const offsetFn = offsetTurbo;
      const interpFn = interpolateTurbo;
      this.colorFunction = (metadata) => interpFn(offsetFn(convFn(metadata.buildId)));
    } else {
      this.colorFunction = this.coverageTypeFunction;
    }
  }
}

export { CoverageColorer, carLineColor, trekkerLineColor };
