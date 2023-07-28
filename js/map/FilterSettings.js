import { LineColorType } from "../enums";

const defaults = {
    filterByDate: false,
    minDate: Math.floor(new Date("2018-06-01").getTime()),
    maxDate: Math.floor(new Date("2023-06-01").getTime()),
    showCars: true,
    showTrekkers: true,
    polygonFilter: null,
    lineColorType: LineColorType.CoverageType
};

export class FilterSettings {
    constructor() {
        Object.assign(this, defaults);
    }

    isDefault() {
        return this.filterByDate === defaults.filterByDate
            && this.showCars === defaults.showCars
            && this.showCars === defaults.showTrekkers
            && this.polygonFilter === defaults.polygonFilter
            && this.lineColorType === defaults.lineColorType;
    }
}
