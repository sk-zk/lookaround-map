import { AddressSource, Theme, InitialOrientation } from "./enums.js";

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

  #setDefaultsForMissingFields() {
    const defaults = {
      addressSource: AddressSource.Apple,
      labelsOnTop: true,
      theme: Theme.Automatic,
      initialOrientation: InitialOrientation.North,
      enableHevc: true,
      useMuted: false,
    };
    for (const entry of Object.entries(defaults)) {
      this.#settings[entry[0]] ??= entry[1];
    }
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
    this.#settings.theme = localStorage.getItem("theme");
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
