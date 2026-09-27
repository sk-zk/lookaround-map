import { HistoricalSettings } from "../map/HistoricalSettings";
import { getDateInNDays } from "../util/misc";

const minDate = 1779667200000;

function getDateInputValueAsUtcTimestamp(inputField) {
  return Math.floor(new Date(inputField.value).getTime());
}

export class HistoricalControl {
  #historicalSettings = new HistoricalSettings();
  #historicalA;
  #historicalB;

  settingsChanged = function (settings) {};

  constructor() {
    const enableHistorical = document.querySelector("#enable-historical");
    enableHistorical.checked = false;
    enableHistorical.addEventListener("change", (e) => {
      this.#historicalSettings.enabled = e.target.checked;
      this.onSettingsChanged();
    });

    this.#historicalA = document.querySelector("#historical-date-a");
    this.#historicalA.addEventListener("blur", (_) => {
      const newDate = getDateInputValueAsUtcTimestamp(this.#historicalA);
      this.#setDateA(newDate);
    });

    const enableDiff = document.querySelector("#enable-diff");
    enableDiff.checked = false;
    enableDiff.addEventListener("change", (e) => {
      this.#historicalSettings.diffingEnabled = e.target.checked;
      this.onSettingsChanged();
    });
    this.#createDateShortcutButtons("#historical-date-a-buttons", 
      (date) => this.#setDateA(date));

    this.#historicalB = document.querySelector("#historical-date-b");
    this.#historicalB.addEventListener("blur", (_) => {
      const newDate = getDateInputValueAsUtcTimestamp(this.#historicalB);
      this.#setDateB(newDate);
    });
    this.#createDateShortcutButtons("#historical-date-b-buttons", 
      (date) => this.#setDateB(date));

    this.#syncDateSelectors();
  }

  #createDateShortcutButtons(divSelector, newDateCallback) {
    const template = [
      { type: "furthest" },
      { type: "month", offset: 2 },
      { type: "month", offset: 1 },
      { type: "day", offset: 7 },
      { type: "now" },
    ];

    const container = document.querySelector(divSelector);

    for (const offset of template) {
      const button = document.createElement("button");
      if (offset.type === "furthest") {
        button.innerHTML = "&#x276C;&#x276C; start";
        button.onclick = () => {
          newDateCallback(minDate);
        };
      } else if (offset.type === "month") {
        button.innerHTML = `&#x276C; ${offset.offset}mo`;
        button.onclick = () => {
          const newDate = getDateInNDays(-offset.offset * 30);
          newDateCallback(newDate);
        };
      } else if (offset.type === "day") {
        button.innerHTML = `&#x276C; ${offset.offset}d`;
        button.onclick = () => {
          const newDate = getDateInNDays(-offset.offset);
          newDateCallback(newDate);
        };
      } else if (offset.type === "now") {
        button.innerHTML = "now &#x276D;&#x276D;";
        button.onclick = () => {
          const newDate = Math.floor(Date.now());
          newDateCallback(newDate);
        };
      }
      container.appendChild(button);
    }
  }

  #setDateA(newDate) {
    if (newDate < minDate) {
      newDate = minDate;
    }

    if (this.#historicalSettings.dateB < newDate) {
      this.#historicalSettings.dateA = this.#historicalSettings.dateB;
      this.#historicalSettings.dateB = newDate;
    } else {
      this.#historicalSettings.dateA = newDate;
    }

    this.#syncDateSelectors();

    if (this.#historicalSettings.enabled) {
      this.onSettingsChanged();
    }
  }

  #setDateB(newDate) {
    if (newDate < minDate) {
      newDate = minDate;
    }

    if (this.#historicalSettings.dateA > newDate) {
      this.#historicalSettings.dateB = this.#historicalSettings.dateA;
      this.#historicalSettings.dateA = newDate;
    } else {
      this.#historicalSettings.dateB = newDate;
    }

    this.#syncDateSelectors();

    if (this.#historicalSettings.enabled &&
      this.#historicalSettings.diffingEnabled) {
      this.onSettingsChanged();
    }
  }

  #syncDateSelectors() {
    this.#historicalA.value = new Date(this.#historicalSettings.dateA)
      .toISOString().split("T")[0];
    this.#historicalB.value = new Date(this.#historicalSettings.dateB)
      .toISOString().split("T")[0];
  }

  onSettingsChanged() {
    this.settingsChanged(this.#historicalSettings);
  }

  getSettings() {
    return this.#historicalSettings;
  }
}
