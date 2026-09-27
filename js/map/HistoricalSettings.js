import { getDateInNDays } from "../util/misc";

const defaults = {
  enabled: false,
  diffingEnabled: false,
  dateA: getDateInNDays(-14).getTime(),
  dateB: Math.floor(Date.now()),
};

export class HistoricalSettings {
  constructor() {
    Object.assign(this, defaults);
  }
}
