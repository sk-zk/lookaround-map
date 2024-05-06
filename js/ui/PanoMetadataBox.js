import { getUserLocale } from "../util/misc.js";
import { NominatimReverseGeocoder, AppleReverseGeocoder } from "../geo/geocoders.js";
import { AddressSource } from "../enums.js";
import { settings } from "../settings.js";

export class PanoMetadataBox {
  #address;
  #appTitle;
  #geocoder;
  #panoId;
  #buildId;
  #position;
  #elevation;
  #date;
  #addressFirstLine;
  #addressRest;

  constructor(appTitle) {
    this.#address = null;
    this.#appTitle = appTitle;
    this.#geocoder = this.#constructGeocoder();
    this.#panoId = document.querySelector("#pano-id");
    this.#buildId = document.querySelector("#pano-build-id");
    this.#position = document.querySelector("#pano-pos");
    this.#elevation = document.querySelector("#pano-ele");
    this.#date = document.querySelector("#pano-date");
    this.#addressFirstLine = document.querySelector("#pano-address-first-line");
    this.#addressRest = document.querySelector("#pano-address-rest");
    document.addEventListener("settingChanged", (e) => {
        if (e.setting[0] === "addressSource") {
            this.#geocoder = this.#constructGeocoder();
        }
    });
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

  async update(pano) {
    this.#panoId.innerHTML = `${pano.panoid}`;
    this.#buildId.innerHTML = `${pano.buildId}`;
    this.#position.innerHTML = `${pano.lat.toFixed(6)}, ${pano.lon.toFixed(6)}`;
    this.#elevation.innerHTML = `${pano.elevation.toFixed(2)} m`;
    /*document.querySelector("#dbg").innerHTML = 
        `<br>Y:${pano.heading * RAD2DEG}° P:${pano.pitch * RAD2DEG}° R:${pano.roll * RAD2DEG}°`;*/
    const date = new Date(pano.timestamp);
    const locale = getUserLocale();
    const formattedDate = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: pano.timezone,
    }).format(date);
    this.#date.innerHTML = formattedDate;
    this.#fetchAndSetAddress(pano.lat, pano.lon);
  }

  async #fetchAndSetAddress(lat, lon) {
    const address = await this.#geocoder.reverseGeocode(lat, lon, getUserLocale());
    this.#address = address;
    if (address.length === 0) {
      this.#addressFirstLine.innerText = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      this.#addressRest.innerHTML = "";
      document.title = `${this.#appTitle}`;
    } else {
      this.#addressFirstLine.innerText = address[0];

      let html = address
        .slice(1)
        .filter((x) => x !== "")
        .join("<br>");
      if (this.#geocoder.attributionText) {
        html += `<div id="nominatim-attribution">${this.#geocoder.attributionText}</div>`;
      }
      html += "<hr>";

      this.#addressRest.innerHTML = html;
      document.title = `${address[0]} – ${this.#appTitle}`;
    }
  }

  updateVisibility() {
    if (
      window.matchMedia("only screen and (max-width: 1000px)").matches ||
      window.matchMedia("only screen and (max-height: 650px)").matches
    ) {
      document.querySelector("#pano-info-details").removeAttribute("open");
    } else {
      document.querySelector("#pano-info-details").open = true;
    }
  }

  getAddress() {
    return this.#address;
  }
}
