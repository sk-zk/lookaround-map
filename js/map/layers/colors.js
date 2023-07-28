import { interpolateTurbo } from "d3-scale-chromatic";
import { LineColorType, CoverageType } from "../../enums.js";

const earliestDate = 1527811200000; // 2018-06-01
const latestDate =   1685577600000; // 2023-06-01

const carLineColor = "rgba(26, 159, 176, 1)";
const trekkerLineColor = "rgba(173, 140, 191, 1)";

function determineLineColor(filterSettings, timestamp, coverageType) {
  let color;
  if (filterSettings.lineColorType === LineColorType.Age) {
    let start;
    let range;
    if (filterSettings.filterByDate) {
      start = filterSettings.minDate;
      range = filterSettings.maxDate - filterSettings.minDate;
    } else {
      start = earliestDate;
      range = latestDate - earliestDate;
    }
    const age = (timestamp - start) / range;
    color = interpolateTurbo(0.5 - age + 0.5);
  } else {
    color = coverageType === CoverageType.Car ? carLineColor : trekkerLineColor;
  }
  return color;
}

export { determineLineColor, carLineColor, trekkerLineColor };
