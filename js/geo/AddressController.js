import {
  NominatimReverseGeocoder,
  AppleReverseGeocoder,
} from "./geocoders.js";
import { AddressSource } from "../enums.js";
import { settings } from "../settings.js";

export class AddressController {
  #geocoder;

  constructor() {
    this.#geocoder = this.#constructGeocoder();
    document.addEventListener("settingChanged", (e) => {
      if (e.setting[0] === "addressSource") {
        this.#geocoder = this.#constructGeocoder();
      }
    });
  }

  async fetchAddress(lat, lon, lang) {
    let address;
    let error = null;
    try {
      address = await this.#geocoder.reverseGeocode(lat, lon, lang);
    } catch (err) {
      error = err;
    }
    document.dispatchEvent(
      new AddressChangedEvent(address, this.#geocoder.attributionText, error)
    );
  }

  #constructGeocoder() {
    switch (settings.get("addressSource")) {
      case AddressSource.Nominatim:
        return new NominatimReverseGeocoder();
      default:
      case AddressSource.Apple:
        return new AppleReverseGeocoder();
    }
  }
}

export class AddressChangedEvent extends Event {
  constructor(address, attribution, error) {
    super("addressChanged");
    this.address = address;
    this.attribution = attribution;
    this.error = error;
  }
}
