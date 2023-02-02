import { LineColorType } from "../enums.js";

const Constants = Object.freeze({
  MAX_ZOOM: 19,
  DEFAULT_FILTERS: {
    filterByDate: false,
    minDate: Math.floor(new Date("2018-01-01").getTime()),
    maxDate: Math.floor(new Date("2023-01-01").getTime()),
    showCars: true,
    showTrekkers: true,
    polygonFilter: null,
    lineColorType: LineColorType.CoverageType
  },
});
export { Constants };
