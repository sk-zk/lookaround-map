import { LineColorType, CoverageType } from "../../enums.js";
import { FilterSettings } from "../FilterSettings.js";

import * as d3 from "d3";
import { interpolateTurbo } from "d3-scale-chromatic";

const earliestDate = Math.floor(new Date("2018-06-01").getTime());
const latestDate =   Math.floor(new Date("2025-06-01").getTime());

const carLineColor = "rgba(26, 159, 176, 1)";
const trekkerLineColor = "rgba(173, 140, 191, 1)";

function offsetTurbo(n) {
  return 0.5 - n + 0.5;
}

function circlesOnly(lineColorType) {
  return lineColorType === LineColorType.BuildId;
}

class CoverageColorer {
  #filterSettings = new FilterSettings();
  coverageTypeFunction;
  colorFunction;
  unscaledColorFunction;
  scale;

  constructor() {
    this.coverageTypeFunction = metadata => 
      metadata.coverageType === CoverageType.Car ? carLineColor : trekkerLineColor;
    this.colorFunction = this.coverageTypeFunction;
    this.unscaledColorFunction = this.coverageTypeFunction;
  }

  determineLineColor(metadata) {
    if (circlesOnly(this.#filterSettings.lineColorType)) {
      return this.coverageTypeFunction(metadata);
    }
    return this.unscaledColorFunction(metadata);
  }

  determineCircleColor(metadata) {
    return this.unscaledColorFunction(metadata);
  }

  filterSettingsChanged(filterSettings) {
    this.#filterSettings = filterSettings;
    if (filterSettings.lineColorType === LineColorType.CoverageType) {
      this.colorFunction = this.coverageTypeFunction;
      this.unscaledColorFunction = this.coverageTypeFunction;
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
      this.scale = d3.scaleLinear().domain([start, end]);
      this.colorFunction = n => interpolateTurbo(offsetTurbo(n));
      this.unscaledColorFunction = metadata => this.colorFunction(this.scale(metadata.timestamp));
    } else if (filterSettings.lineColorType === LineColorType.BuildId) {
      const start = 511228947; // lowest value discovered since I started scraping
      const end = 2200000000; // highest value plus some breathing room
      this.scale = d3.scaleLinear().domain([start, end]);
      this.colorFunction = n => interpolateTurbo(offsetTurbo(n));
      this.unscaledColorFunction = metadata => this.colorFunction(this.scale(metadata.buildId));
    } else {
      this.colorFunction = this.coverageTypeFunction;
      this.unscaledColorFunction = this.coverageTypeFunction;
    }
  }
}

function getTileModifiedColor(lastModified) {
  const start = 1577836800; // 2020-01-01
  const end = Date.now() / 1000;
  const percent = (lastModified - start) / (end-start);
  return interpolateTurbo(offsetTurbo(percent));
}

export { CoverageColorer, carLineColor, trekkerLineColor, getTileModifiedColor };
