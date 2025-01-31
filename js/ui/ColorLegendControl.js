import { LineColorType } from "../enums";

import * as d3 from "d3";

export class ColorLegendControl {
  coverageColorer;
  #containerId = "#color-legend";
  #colorsElId = "#color-legend-colors";
  #axisElId = "#color-legend-axis";
  #colorsEl = d3.select(this.#colorsElId);
  #axisEl = d3.select(this.#axisElId);

  constructor(coverageColorer) {
    this.coverageColorer = coverageColorer;
  }

  updateLegend(filterSettings) {
    if (filterSettings.lineColorType === LineColorType.CoverageType) {
      document.querySelector(this.#containerId).style.display = "none";
      return;
    }

    document.querySelector(this.#containerId).style.display = "block";
    this.#createGradient();
    let tickConfigFn;
    if (filterSettings.lineColorType === LineColorType.Age) {
      tickConfigFn = (axis) => {
        axis.tickValues(this.#createAgeTickValues());
        axis.tickFormat((n) => new Date(n).getFullYear());
      };
    } else if (filterSettings.lineColorType === LineColorType.BuildId) {
      tickConfigFn = (axis) => {
        axis.tickValues(this.#createBuildIdTickValues());
        axis.tickFormat((n) => `${(n / 1_000_000) | 0}`);
      };
    }
    this.#createAxis(tickConfigFn);
  }

  #createScale() {
    const scaleWidth = this.#colorsEl.node().getBoundingClientRect().width;
    const scale = this.coverageColorer.scale.copy();
    scale.range([0, scaleWidth]);
    return scale;
  }

  #createAxis(tickConfigFn) {
    const width = this.#axisEl.node().getBoundingClientRect().width;
    const height = this.#axisEl.node().getBoundingClientRect().height;

    const scale = this.#createScale();
    const axis = d3.axisBottom(scale);
    tickConfigFn(axis);

    this.#axisEl.html("");
    const svg = this.#axisEl
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const margin = 20;
    svg
      .append("g")
      .attr("width", width + margin)
      .attr("height", height)
      .attr("transform", `translate(${margin},0)`)
      .call(axis);
  }

  #createAgeTickValues() {
    const scale = this.coverageColorer.scale;
    const earliestYear = new Date(scale.invert(0)).getFullYear();
    const latestYear = new Date(scale.invert(1)).getFullYear();
    let tickValues = [scale.invert(0)];
    for (let i = earliestYear + 1; i < latestYear + 1; i++) {
      tickValues.push(new Date(i, 0, 1).getTime());
    }
    return tickValues;
  }

  #createBuildIdTickValues() {
    const scale = this.coverageColorer.scale;
    const start = scale.invert(0);
    const end = scale.invert(1);
    let tickValues = [];
    const interval = (end - start) / 6;
    for (let i = start; i < end; i += interval) {
      tickValues.push(i);
    }
    tickValues.push(end);
    return tickValues;
  }

  #createGradient() {
    const width = this.#colorsEl.node().getBoundingClientRect().width;
    const height = this.#colorsEl.node().getBoundingClientRect().height;

    this.#colorsEl.html("");
    const svg = this.#colorsEl
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "color-legend-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    const numStops = 100;
    for (let i = 0; i <= numStops; i++) {
      const n = i / numStops;
      gradient
        .append("stop")
        .attr("offset", `${n * 100}%`)
        .attr("stop-color", this.coverageColorer.colorFunction(n));
    }

    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "url(#color-legend-gradient)");
  }
}
