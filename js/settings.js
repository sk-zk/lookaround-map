import { AddressSource, Theme } from "./enums.js";

class Settings {
  #settings = {};

  constructor() {
    if ("settings" in localStorage) {
      this.#settings = JSON.parse(localStorage.getItem("settings"));
    } else {
      this.#getLegacySettings();
    }
    this.#setDefaultsForMissingFields();
    this.#save();
  }

  get(key) {
    return this.#settings[key];
  }

  set(key, value) {
    this.#settings[key] = value;
    this.#save();
    document.dispatchEvent(new SettingChangedEvent(key, value));
  }

  #getLegacySettings() {
    this.#settings.addressSource = localStorage.getItem("addrSource");
    this.#settings.labelsOnTop = JSON.parse(
      localStorage.getItem("labelsOnTop")
    );
    this.#settings.showFullPano = JSON.parse(
      localStorage.getItem("showFullPano")
    );
    this.#settings.theme = localStorage.getItem("theme");
  }

  #setDefaultsForMissingFields() {
    const defaults = {
      addressSource: AddressSource.Apple,
      labelsOnTop: true,
      showFullPano: true,
      theme: Theme.Automatic,
    };
    for (const entry of Object.entries(defaults)) {
      this.#settings[entry[0]] ??= entry[1];
    }
  }

  #save() {
    localStorage.setItem("settings", JSON.stringify(this.#settings));
  }
}

export class SettingChangedEvent extends Event {
  constructor(key, value) {
    super("settingChanged");
    this.setting = [key, value];
  }
}

const settings = new Settings();
export { settings };