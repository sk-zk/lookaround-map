import { AddressSource, Theme, InitialOrientation, DataLang } from "./enums.js";

class Settings {
  #settings = {};

  constructor() {
    if ("settings" in localStorage) {
      this.#settings = JSON.parse(localStorage.getItem("settings"));
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
      decodeClientside: true,
      useMuted: false,
      showTileModifiedDate: false,
      dataLang: DataLang.Default,
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
